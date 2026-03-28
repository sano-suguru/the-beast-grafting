terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

resource "cloudflare_ruleset" "rate_limiting" {
  zone_id = var.zone_id
  name    = "Auth rate limiting"
  kind    = "zone"
  phase   = "http_ratelimit"

  rules = [
    {
      action      = "block"
      expression  = "(http.request.uri.path eq \"/api/auth/login\" and http.request.method eq \"POST\")"
      description = "Rate limit login attempts"
      ratelimit = {
        characteristics     = ["ip.src"]
        period              = 60
        requests_per_period = 5
        mitigation_timeout  = 60
      }
    },
    {
      action      = "block"
      expression  = "(http.request.uri.path eq \"/api/auth/register\" and http.request.method eq \"POST\")"
      description = "Rate limit registration attempts"
      ratelimit = {
        characteristics     = ["ip.src"]
        period              = 60
        requests_per_period = 3
        mitigation_timeout  = 60
      }
    },
    {
      action      = "block"
      expression  = "(http.request.uri.path eq \"/api/auth/guest\" and http.request.method eq \"POST\")"
      description = "Rate limit guest account creation"
      ratelimit = {
        characteristics     = ["ip.src"]
        period              = 60
        requests_per_period = 10
        mitigation_timeout  = 60
      }
    },
  ]
}
