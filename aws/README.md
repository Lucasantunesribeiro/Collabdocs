# AWS Deployment — CollabDocs .NET API

Production infrastructure for the CollabDocs .NET API on AWS ECS Fargate.

## Architecture Overview

```
Internet
    |
    v
[ALB — public subnets]
    |  HTTP :80
    v
[ECS Fargate task — private subnets]
    |           |           |
    v           v           v
[RDS         [ElastiCache  [Amazon MQ
 PostgreSQL]   Redis]        RabbitMQ]
                |
                v
            [SQS FIFO Queue — document events]
```

All compute (ECS) and data (RDS, Redis, MQ) resources run in **private subnets**.
Only the ALB is in public subnets. ECS tasks reach the internet (ECR pulls, Secrets Manager)
via the NAT Gateway.

## Prerequisites

- AWS CLI v2 configured (`aws configure`)
- Docker (for local testing with `docker-compose.aws.yml`)
- An AWS account with permissions to create VPC, ECS, RDS, ElastiCache, SQS, IAM resources

## Deploy the CloudFormation Stack

```bash
aws cloudformation deploy \
  --template-file aws/cloudformation.yml \
  --stack-name collabdocs \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
      DBPassword="${DB_PASSWORD}" \
      MQPassword="${MQ_PASSWORD}" \
      JwtSecret="${JWT_SECRET}"
```

The stack creates all resources including ECR repository, VPC, subnets, security groups, RDS,
ElastiCache Redis, SQS queues, Amazon MQ, ECS cluster, ALB, IAM roles, and CloudWatch log group.

After deploy, get the ALB DNS name:

```bash
aws cloudformation describe-stacks \
  --stack-name collabdocs \
  --query "Stacks[0].Outputs[?OutputKey=='ALBDNSName'].OutputValue" \
  --output text
```

## Push the First Docker Image

```bash
ECR_URI=$(aws cloudformation describe-stacks \
  --stack-name collabdocs \
  --query "Stacks[0].Outputs[?OutputKey=='ECRRepositoryURI'].OutputValue" \
  --output text)

aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin "$ECR_URI"

docker build -f dotnet/src/CollabDocs.API/Dockerfile -t collabdocs-api:latest ./dotnet
docker tag collabdocs-api:latest "$ECR_URI:latest"
docker push "$ECR_URI:latest"
```

## Required GitHub Secrets

Set these in your repository at Settings > Secrets and variables > Actions:

| Secret | Description | Example |
|--------|-------------|---------|
| `AWS_ROLE_ARN` | IAM role ARN with OIDC trust for GitHub Actions | `arn:aws:iam::123456789012:role/github-actions-collabdocs` |
| `AWS_REGION` | Target AWS region | `us-east-1` |
| `ECR_REPOSITORY` | ECR repository name (not full URI) | `collabdocs-api` |

### Setting Up OIDC Trust (one-time)

Create an IAM role that trusts GitHub's OIDC provider:

```bash
# 1. Create the OIDC provider (once per account)
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# 2. Create the role with a trust policy scoped to your repo
# Replace YOUR_GITHUB_ORG/YOUR_REPO with your actual values
aws iam create-role \
  --role-name github-actions-collabdocs \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_ORG/YOUR_REPO:*"
        }
      }
    }]
  }'
```

Attach policies to the role: `AmazonECS_FullAccess`, `AmazonEC2ContainerRegistryPowerUser`,
`CloudFormationReadOnlyAccess`.

## SSM Parameters (Alternative to Secrets Manager)

The CloudFormation stack uses Secrets Manager directly. If you prefer SSM Parameter Store for
simpler secrets, set these before deploying:

```bash
aws ssm put-parameter --name "/collabdocs/jwt-secret" \
  --value "${JWT_SECRET}" --type SecureString

aws ssm put-parameter --name "/collabdocs/db-password" \
  --value "${DB_PASSWORD}" --type SecureString
```

## Local Testing (AWS Topology Simulation)

Test the full stack locally before deploying:

```bash
# Create a local env file (gitignored)
cat > .env.aws.local <<EOF
POSTGRES_PASSWORD=localdevpassword123
JWT_SECRET=local-dev-jwt-secret-at-least-32-chars
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
EOF

docker compose -f aws/docker-compose.aws.yml --env-file .env.aws.local up --build
```

Health check: `curl http://localhost:5000/health`

## Cost Estimate (us-east-1, ~730 hours/month)

| Resource | Config | Est. Monthly Cost |
|----------|--------|-------------------|
| ECS Fargate | 0.5 vCPU, 1 GB, 1 task | ~$15 |
| RDS PostgreSQL | db.t3.micro, 20 GB gp3 | ~$15 |
| ElastiCache Redis | cache.t3.micro | ~$13 |
| Amazon MQ | mq.t3.micro | ~$25 |
| ALB | 1 LCU estimated | ~$20 |
| NAT Gateway | ~10 GB data | ~$35 |
| ECR | 1 GB storage | ~$0.10 |
| CloudWatch Logs | 5 GB/month estimated | ~$3 |
| SQS | Under free tier (1M requests) | ~$0 |
| **Total estimate** | | **~$126/month** |

Note: NAT Gateway is the dominant cost. For a low-traffic portfolio project, consider using
VPC Endpoints for ECR and Secrets Manager to reduce NAT traffic.

## Rollback

The ECS service has `DeploymentCircuitBreaker` enabled — it automatically rolls back to the
previous task definition revision if the new tasks fail health checks.

Manual rollback:

```bash
# List recent task definition revisions
aws ecs list-task-definitions --family-prefix collabdocs-api --sort DESC

# Force the service to use a specific revision
aws ecs update-service \
  --cluster collabdocs-cluster \
  --service collabdocs-api-service \
  --task-definition collabdocs-api:PREVIOUS_REVISION_NUMBER \
  --force-new-deployment
```

## Monitoring

- **Logs**: CloudWatch Log Group `/ecs/collabdocs-api`
- **Alarms**: `collabdocs-api-high-cpu`, `collabdocs-api-high-memory`,
  `collabdocs-api-unhealthy-tasks`, `collabdocs-api-5xx-errors`
- **Health endpoint**: `GET /health` (returns `{"status":"healthy","timestamp":"..."}`)

Stream live ECS logs:

```bash
aws logs tail /ecs/collabdocs-api --follow
```
