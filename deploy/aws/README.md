# Deploying to AWS (single EC2 instance)

This deploys the backend, web dashboard, and MongoDB as one Docker Compose stack on an
Amazon Linux 2023 EC2 instance with an elastic IP. It mirrors `docker-compose.yml`, minus
ngrok (the elastic IP replaces it) and with MongoDB kept off the public network.

## What gets created

| Resource | Name | Notes |
| --- | --- | --- |
| EC2 instance | `employee-monitor` | t3.small, 30 GB gp3, Docker + 2 GB swap |
| Elastic IP | tagged on the instance | stable public address |
| Security group | `employee-monitor-sg` | 3000 (API) and 5173 (dashboard) from anywhere |
| IAM role/profile | `employee-monitor-role` / `-profile` | S3 bundle read + SSM Session Manager |
| S3 bucket | `employee-monitor-deploy-<account>-<region>` | private, holds the source bundle |

## Usage

```bash
aws configure          # or: aws sso login
./deploy/aws/deploy.sh

# optional overrides
NAME=acme-monitor INSTANCE_TYPE=t3.medium AWS_REGION=eu-west-1 ./deploy/aws/deploy.sh

# tear down everything the script created
./deploy/aws/deploy.sh --destroy
```

No Docker is needed locally: the instance builds the images itself.

## Accessing the host

Port 22 is not opened. Use SSM Session Manager (the instance profile includes
`AmazonSSMManagedInstanceCore`):

```bash
aws ssm start-session --target <instance-id>
sudo tail -f /var/log/employee-monitor-boot.log
cd /opt/employee-monitor && sudo docker compose ps
```

## Pointing the Android app at it

In the app's setup screen set the server URL to `http://<elastic-ip>:3000`.
`network_security_config.xml` already allows cleartext HTTP, so no rebuild is required.

## Before using this for real

- **No HTTPS.** There is no domain or TLS certificate; all traffic, including login
  credentials and screenshots, is plain HTTP. Put a domain behind the instance and add TLS
  (e.g. Caddy or an ALB with ACM) before sending real employee data.
- **Open registration.** `POST /api/auth/register` is unauthenticated and creates admin
  users. Anyone who finds the IP can create an account. Create your admin immediately and
  restrict or remove that route.
- **Restrict the security group.** `deploy.sh` allows 3000/5173 from `0.0.0.0/0` so phones
  on mobile networks can reach the API. Narrow the ingress rules if your devices use a
  known range.
- **Single host, no backups.** Screenshots and MongoDB live in Docker volumes on one EBS
  volume. A terminated instance loses them; schedule EBS snapshots and database backups.
- **Jurisdiction.** Covert device monitoring is tightly regulated (consent, works-council
  and notice requirements). Confirm the legal basis before enrolling anyone's device.
