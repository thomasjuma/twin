terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  # Uses AWS CLI configuration (aws configure)
}

# CloudFront can only use ACM certificates from us-east-1 (N. Virginia).
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}