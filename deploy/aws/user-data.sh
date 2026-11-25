#!/bin/bash
# First-boot setup for the Employee Monitor EC2 host.
# __BUCKET__ and __REGION__ are substituted by deploy.sh before launch.
set -euxo pipefail
exec > >(tee -a /var/log/employee-monitor-boot.log) 2>&1

BUCKET="__BUCKET__"
REGION="__REGION__"
APP_DIR="/opt/employee-monitor"

# Docker engine + AWS CLI (used to fetch the deployment bundle).
dnf install -y docker
systemctl enable --now docker
if ! command -v aws >/dev/null 2>&1; then
  dnf install -y awscli-2 || dnf install -y aws
fi

# Compose v2 plugin (AL2023's docker package does not ship it).
COMPOSE_VERSION="v2.29.7"
mkdir -p /usr/libexec/docker/cli-plugins
curl -fsSL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
  -o /usr/libexec/docker/cli-plugins/docker-compose
chmod +x /usr/libexec/docker/cli-plugins/docker-compose

# Small hosts need swap for the Vite/npm builds.
if [ ! -f /swapfile ]; then
  dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# The instance profile can take a few seconds to become visible to S3.
mkdir -p "$APP_DIR"
cd "$APP_DIR"
for i in $(seq 1 24); do
  if aws s3 cp "s3://${BUCKET}/app.tar.gz" app.tar.gz --region "$REGION"; then
    break
  fi
  sleep 5
done
test -f app.tar.gz
tar -xzf app.tar.gz
rm -f app.tar.gz

docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
