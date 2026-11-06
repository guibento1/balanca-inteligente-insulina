import hmac
import os

from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


class APIKeyUser:
    is_authenticated = True

    def __init__(self):
        self.username = "api-client"


class APIKeyAuthentication(BaseAuthentication):
    """Authenticate API clients with the deployment-provided API key."""

    def authenticate(self, request):
        configured_key = os.getenv("BALANCA_API_KEY")
        supplied_key = request.headers.get("X-API-Key")

        if not configured_key:
            raise AuthenticationFailed(
                "BALANCA_API_KEY is not configured on the server."
            )
        if not supplied_key or not hmac.compare_digest(supplied_key, configured_key):
            raise AuthenticationFailed("Invalid API key.")

        return APIKeyUser(), None
