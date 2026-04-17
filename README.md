# twin
My digital twin.



## Architecture

```
User Browser
    ↓ HTTPS
CloudFront (CDN)
    ↓ 
S3 Static Website (Frontend)
    ↓ HTTPS API Calls
API Gateway
    ↓
Lambda Function (Backend)
    ↓
    ├── AWS Bedrock (AI responses)
    └── S3 Memory Bucket (persistence)
```

### Key Components

1. **CloudFront**: Global CDN, provides HTTPS, caches static content
2. **S3 Frontend Bucket**: Hosts static Next.js files
3. **API Gateway**: Manages API routes, handles CORS
4. **Lambda**: Runs the Python backend serverlessly
5. **S3 Memory Bucket**: Stores conversation history as JSON files

----
```
Terraform Configuration
    ├── S3 Buckets (Frontend + Memory)
    ├── Lambda Function with IAM Role
    ├── API Gateway with Routes
    ├── CloudFront Distribution
    └── Optional: Route 53 + ACM Certificate

Managed via Workspaces:
    ├── dev/   (Development environment)
    ├── test/  (Testing environment)
    └── prod/  (Production with custom domain)
```