from fastapi import Query, Request

from server.locale.log_messages import normalize_locale


def get_request_locale(
    request: Request,
    locale: str | None = Query(None, description="UI locale override (es or en)"),
) -> str:
    if locale:
        return normalize_locale(locale)
    accept = (request.headers.get("accept-language") or "").strip()
    if not accept:
        return "es"
    first = accept.split(",")[0].strip().split(";")[0].strip()
    return normalize_locale(first or None)
