#!/usr/bin/env bash
# Deploy Employee Monitor to one EC2 instance running the production Compose stack.
#
#   ./deploy/aws/deploy.sh            # create/update the deployment
#   ./deploy/aws/deploy.sh --destroy  # remove every resource this script created
#
# Requires an authenticated AWS CLI v2 (aws configure / aws sso login).
set -euo pipefail

NAME="${NAME:-employee-monitor}"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.small}"
VOLUME_SIZE_GB="${VOLUME_SIZE_GB:-30}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
STATE_DIR="$SCRIPT_DIR/.out"
STATE_FILE="$STATE_DIR/state.env"
TMP_DIR="$SCRIPT_DIR/.tmp"
# AWS CLI on Windows resolves file:// against a Windows cwd, so use paths relative to the repo root.
TMP_REL="deploy/aws/.tmp"

log() { printf '\n==> %s\n' "$*"; }
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

for cmd in aws tar curl; do
  command -v "$cmd" >/dev/null 2>&1 || die "Missing required command: $cmd"
done

gen_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 24
  else
    node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
  fi
}

cd "$REPO_ROOT"

if [ "${1:-}" = "--destroy" ]; then
  if [ -f "$STATE_FILE" ]; then
    # shellcheck disable=SC1090
    . "$STATE_FILE"
  fi
  INSTANCE_ID="${INSTANCE_ID:-}"
  ALLOC_ID="${ALLOC_ID:-}"
  SG_ID="${SG_ID:-}"
  BUCKET="${BUCKET:-}"

  log "Destroying deployment '$NAME' in $REGION"
  if [ -n "$INSTANCE_ID" ]; then
    aws ec2 terminate-instances --region "$REGION" --instance-ids "$INSTANCE_ID" >/dev/null || true
    aws ec2 wait instance-terminated --region "$REGION" --instance-ids "$INSTANCE_ID" || true
  fi
  if [ -n "$ALLOC_ID" ]; then
    aws ec2 release-address --region "$REGION" --allocation-id "$ALLOC_ID" >/dev/null || true
  fi
  if [ -n "$SG_ID" ]; then
    aws ec2 delete-security-group --region "$REGION" --group-id "$SG_ID" >/dev/null || true
  fi
  aws iam remove-role-from-instance-profile --instance-profile-name "${NAME}-profile" --role-name "${NAME}-role" >/dev/null 2>&1 || true
  aws iam delete-instance-profile --instance-profile-name "${NAME}-profile" >/dev/null 2>&1 || true
  aws iam delete-role-policy --role-name "${NAME}-role" --policy-name "${NAME}-s3-read" >/dev/null 2>&1 || true
  aws iam detach-role-policy --role-name "${NAME}-role" --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore >/dev/null 2>&1 || true
  aws iam delete-role --role-name "${NAME}-role" >/dev/null 2>&1 || true
  if [ -n "$BUCKET" ]; then
    aws s3 rm "s3://${BUCKET}" --recursive >/dev/null 2>&1 || true
    aws s3api delete-bucket --bucket "$BUCKET" --region "$REGION" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_DIR" "$STATE_DIR"
  log "Destroy complete."
  exit 0
fi

aws sts get-caller-identity >/dev/null 2>&1 ||
  die "AWS CLI is not authenticated. Run 'aws configure' or 'aws sso login' first."

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="${NAME}-deploy-${ACCOUNT_ID}-${REGION}"

if [ -f "$STATE_FILE" ]; then
  # shellcheck disable=SC1090
  . "$STATE_FILE"
  if [ -n "${INSTANCE_ID:-}" ]; then
    CURRENT_STATE="$(aws ec2 describe-instances --region "$REGION" --instance-ids "$INSTANCE_ID" \
      --query 'Reservations[0].Instances[0].State.Name' --output text 2>/dev/null || echo missing)"
    if [ "$CURRENT_STATE" != "missing" ] && [ "$CURRENT_STATE" != "terminated" ]; then
      die "A deployment already exists (instance $INSTANCE_ID, state: $CURRENT_STATE).
To redeploy: ./deploy/aws/deploy.sh --destroy, then run this script again."
    fi
  fi
fi

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR/app" "$STATE_DIR"

log "Bundling project source"
tar -C "$REPO_ROOT" -cf - \
  --exclude='backend/node_modules' \
  --exclude='backend/uploads' \
  --exclude='backend/.env' \
  --exclude='web-dashboard/node_modules' \
  --exclude='web-dashboard/dist' \
  --exclude='web-dashboard/.env' \
  backend web-dashboard | tar -C "$TMP_DIR/app" -xf -
cp "$SCRIPT_DIR/docker-compose.prod.yml" "$TMP_DIR/app/docker-compose.prod.yml"

JWT_SECRET="${JWT_SECRET:-$(gen_secret)}"
MONGO_PASSWORD="${MONGO_PASSWORD:-$(gen_secret)}"
ADMIN_SECRET="${ADMIN_SECRET:-$(gen_secret)}"

cat > "$TMP_DIR/app/.env.production" <<EOF
MONGO_USER=admin
MONGO_PASSWORD=$MONGO_PASSWORD
JWT_SECRET=$JWT_SECRET
JWT_EXPIRE=7d
ADMIN_SECRET=$ADMIN_SECRET
CLIENT_URL=
HEARTBEAT_TIMEOUT_SECONDS=90
EOF

tar -C "$TMP_DIR/app" -czf "$TMP_DIR/app.tar.gz" .

log "Ensuring S3 bucket $BUCKET"
if ! aws s3api head-bucket --bucket "$BUCKET" --region "$REGION" >/dev/null 2>&1; then
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" >/dev/null
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
      --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null
  fi
fi
aws s3api put-public-access-block --bucket "$BUCKET" --region "$REGION" \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
aws s3 cp "$TMP_DIR/app.tar.gz" "s3://${BUCKET}/app.tar.gz" --region "$REGION" >/dev/null

log "Configuring IAM role for the instance"
cat > "$TMP_DIR/trust.json" <<'EOF'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}
EOF
cat > "$TMP_DIR/s3-policy.json" <<EOF
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:GetObject"],"Resource":"arn:aws:s3:::${BUCKET}/*"}]}
EOF

aws iam get-role --role-name "${NAME}-role" >/dev/null 2>&1 ||
  aws iam create-role --role-name "${NAME}-role" \
    --assume-role-policy-document "file://$TMP_REL/trust.json" >/dev/null
aws iam attach-role-policy --role-name "${NAME}-role" \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore >/dev/null
aws iam put-role-policy --role-name "${NAME}-role" --policy-name "${NAME}-s3-read" \
  --policy-document "file://$TMP_REL/s3-policy.json"

if ! aws iam get-instance-profile --instance-profile-name "${NAME}-profile" >/dev/null 2>&1; then
  aws iam create-instance-profile --instance-profile-name "${NAME}-profile" >/dev/null
  aws iam add-role-to-instance-profile --instance-profile-name "${NAME}-profile" \
    --role-name "${NAME}-role" >/dev/null
  sleep 10
fi

log "Configuring security group in the default VPC"
VPC_ID="$(aws ec2 describe-vpcs --region "$REGION" --filters Name=is-default,Values=true \
  --query 'Vpcs[0].VpcId' --output text)"
[ "$VPC_ID" != "None" ] || die "No default VPC in $REGION. Create one or adapt deploy.sh to use your VPC."

SG_ID="$(aws ec2 describe-security-groups --region "$REGION" \
  --filters "Name=group-name,Values=${NAME}-sg" "Name=vpc-id,Values=$VPC_ID" \
  --query 'SecurityGroups[0].GroupId' --output text)"
if [ "$SG_ID" = "None" ]; then
  SG_ID="$(aws ec2 create-security-group --region "$REGION" --group-name "${NAME}-sg" \
    --description "Employee Monitor API and dashboard" --vpc-id "$VPC_ID" \
    --query GroupId --output text)"
fi

open_port() {
  local port="$1" existing
  existing="$(aws ec2 describe-security-groups --region "$REGION" --group-ids "$SG_ID" \
    --query "SecurityGroups[0].IpPermissions[?FromPort==\`${port}\`] | length(@)" --output text)"
  if [ "$existing" = "0" ]; then
    aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG_ID" \
      --protocol tcp --port "$port" --cidr 0.0.0.0/0 >/dev/null
  fi
}
open_port 3000
open_port 5173

log "Launching $INSTANCE_TYPE instance"
resolve_ami() {
  local param value
  # Public SSM parameters are the cheapest lookup, but some accounts/regions
  # deny them, so fall back to the image catalog.
  for param in \
    /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
    /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-6.1-x86_64; do
    value="$(aws ssm get-parameter --region "$REGION" --name "$param" \
      --query Parameter.Value --output text 2>/dev/null || true)"
    if [ -n "$value" ] && [ "$value" != "None" ]; then printf '%s' "$value"; return 0; fi
  done
  aws ec2 describe-images --region "$REGION" --owners amazon \
    --filters "Name=name,Values=al2023-ami-2023.*-kernel-6.1-x86_64" "Name=state,Values=available" \
    --query 'reverse(sort_by(Images,&CreationDate))[0].ImageId' --output text 2>/dev/null | tr -d '\r'
}

AMI_ID="$(resolve_ami)"
[ -n "$AMI_ID" ] && [ "$AMI_ID" != "None" ] || die "Could not resolve an Amazon Linux 2023 AMI in $REGION."
sed -e "s|__BUCKET__|$BUCKET|g" -e "s|__REGION__|$REGION|g" \
  "$SCRIPT_DIR/user-data.sh" > "$TMP_DIR/user-data.sh"
cat > "$TMP_DIR/blockdevices.json" <<EOF
[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":$VOLUME_SIZE_GB,"VolumeType":"gp3","DeleteOnTermination":true}}]
EOF

INSTANCE_ID="$(aws ec2 run-instances --region "$REGION" \
  --image-id "$AMI_ID" \
  --instance-type "$INSTANCE_TYPE" \
  --iam-instance-profile "Name=${NAME}-profile" \
  --security-group-ids "$SG_ID" \
  --user-data "file://$TMP_REL/user-data.sh" \
  --block-device-mappings "file://$TMP_REL/blockdevices.json" \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$NAME}]" \
  --query 'Instances[0].InstanceId' --output text)"
aws ec2 wait instance-running --region "$REGION" --instance-ids "$INSTANCE_ID"

log "Allocating elastic IP"
ALLOC_ID="$(aws ec2 allocate-address --region "$REGION" --domain vpc \
  --query AllocationId --output text)"
aws ec2 associate-address --region "$REGION" --instance-id "$INSTANCE_ID" \
  --allocation-id "$ALLOC_ID" >/dev/null
EIP="$(aws ec2 describe-addresses --region "$REGION" --allocation-ids "$ALLOC_ID" \
  --query 'Addresses[0].PublicIp' --output text)"

cat > "$STATE_FILE" <<EOF
NAME=$NAME
REGION=$REGION
INSTANCE_ID=$INSTANCE_ID
ALLOC_ID=$ALLOC_ID
SG_ID=$SG_ID
BUCKET=$BUCKET
EOF

log "Waiting for the stack to build and pass /api/health (this takes several minutes)"
READY=0
for _ in $(seq 1 90); do
  if curl -fsS --max-time 5 "http://${EIP}:3000/api/health" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 10
done

cat <<EOF

Deployment summary
------------------
Dashboard:          http://${EIP}:5173
API:                http://${EIP}:3000
Android server URL: http://${EIP}:3000
Instance:           ${INSTANCE_ID} (${INSTANCE_TYPE}, ${REGION})
SSH-less access:    aws ssm start-session --target ${INSTANCE_ID} --region ${REGION}

Create the first admin account (registration is open until you lock it down):
curl -s -X POST http://${EIP}:3000/api/auth/register \\
  -H 'Content-Type: application/json' \\
  -d '{"name":"Admin","email":"you@example.com","password":"choose-a-strong-password"}'

Runtime secrets were generated and written only to /opt/employee-monitor/.env.production on the instance.
To tear everything down: ./deploy/aws/deploy.sh --destroy
EOF

if [ "$READY" -ne 1 ]; then
  echo
  echo "WARNING: /api/health did not respond yet. Check the boot log:"
  echo "  aws ssm start-session --target ${INSTANCE_ID} --region ${REGION}"
  echo "  sudo tail -f /var/log/employee-monitor-boot.log"
  exit 2
fi
log "Deployment healthy."
