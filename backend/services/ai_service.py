import logging
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from config import settings

logger = logging.getLogger(__name__)
DISCLAIMER = "\n\n※ 본 해설은 AI가 생성한 참고 정보이며 투자 조언이 아닙니다. 투자 판단의 책임은 이용자 본인에게 있습니다."


async def generate_stock_commentary(stock, target_date: date, db: AsyncSession) -> tuple[str, str]:
    """Generate AI commentary for a stock on a given date. Returns (commentary, model_used)."""
    if not settings.anthropic_api_key:
        return "AI API 키가 설정되지 않았습니다. .env 파일에 ANTHROPIC_API_KEY를 설정하세요." + DISCLAIMER, "none"

    from models.stock import PriceSnapshot
    from models.alert import CrossEvent
    from models.disclosure import Disclosure

    # Fetch last 20 days of price data
    price_res = await db.execute(
        select(PriceSnapshot)
        .where(PriceSnapshot.stock_id == stock.id)
        .order_by(desc(PriceSnapshot.date))
        .limit(20)
    )
    prices = list(reversed(price_res.scalars().all()))

    # Fetch recent cross events (5 days)
    from datetime import timedelta
    since_cross = target_date - timedelta(days=5)
    cross_res = await db.execute(
        select(CrossEvent)
        .where(CrossEvent.stock_id == stock.id, CrossEvent.occurred_at >= since_cross)
    )
    crosses = cross_res.scalars().all()

    # Fetch recent disclosures (7 days)
    since_disc = target_date - timedelta(days=7)
    disc_res = await db.execute(
        select(Disclosure)
        .where(Disclosure.stock_id == stock.id, Disclosure.rcept_dt >= since_disc)
    )
    disclosures = disc_res.scalars().all()

    prompt = _build_prompt(stock, target_date, prices, crosses, disclosures)
    model = "claude-haiku-4-5-20251001"

    import anthropic
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    response = client.messages.create(
        model=model,
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    commentary = response.content[0].text + DISCLAIMER
    return commentary, model


def _fmt(val, spec=".0f") -> str:
    return f"{val:{spec}}" if val is not None else "N/A"


def _build_prompt(stock, target_date: date, prices, crosses, disclosures) -> str:
    price_lines = "\n".join(
        f"  {p.date}: 종가 {p.close:,.0f} | MA20={_fmt(p.ma20)} MA60={_fmt(p.ma60)} 거래량비율={_fmt(p.volume_ratio, '.2f')}"
        for p in prices
    )
    cross_lines = "\n".join(
        f"  {c.occurred_at.date()}: {c.event_type} (단기{c.short_val:,.0f}/장기{c.long_val:,.0f})"
        for c in crosses
    ) or "  없음"
    disc_lines = "\n".join(
        f"  {d.rcept_dt}: {d.report_nm}"
        for d in disclosures
    ) or "  없음"

    return f"""당신은 주식 시장 분석가입니다. 아래 데이터를 바탕으로 {stock.name}({stock.ticker})의 최근 주가 움직임을 한국어로 3-4문장 분석해 주세요. 투자 조언은 제공하지 마세요.

[기간] {target_date}

[최근 20일 시세]
{price_lines}

[최근 크로스 이벤트]
{cross_lines}

[최근 공시 (7일)]
{disc_lines}

위 데이터를 바탕으로 가격 움직임의 주요 원인과 기술적 상황을 설명해 주세요. "사야 합니다" 또는 "팔아야 합니다"와 같은 직접적 투자 조언은 하지 마세요."""


async def summarize_disclosure(disclosure) -> str:
    """Summarize a DART disclosure with AI."""
    if not settings.anthropic_api_key:
        return "AI API 키가 설정되지 않았습니다."

    import anthropic
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    prompt = f"다음 공시 내용을 3문장으로 핵심만 요약해 주세요:\n제목: {disclosure.report_nm}\n회사: {disclosure.corp_name}\n날짜: {disclosure.rcept_dt}"
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text
