from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

WIDTH = 1600
HEIGHT = 900
BG = "#09090b"
PANEL = "#111113"
PANEL_ALT = "#18181b"
BORDER = "#27272a"
TEXT = "#f4f4f5"
MUTED = "#a1a1aa"
GREEN = "#34d399"
GREEN_BG = "#052e2b"
RED = "#fb7185"
RED_BG = "#4c0519"
AMBER = "#f59e0b"
AMBER_BG = "#451a03"
WHITE = "#ffffff"

OUT_DIR = Path("apps/web/public/demo-captures")
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT_GIF = OUT_DIR / "trusted-browser-demo.gif"


def load_font(size: int, bold: bool = False):
    candidates = []
    if bold:
        candidates.extend(
            [
                "C:/Windows/Fonts/arialbd.ttf",
                "C:/Windows/Fonts/segoeuib.ttf",
            ]
        )
    candidates.extend(
        [
            "C:/Windows/Fonts/arial.ttf",
            "C:/Windows/Fonts/segoeui.ttf",
        ]
    )
    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


FONT_XS = load_font(16)
FONT_SM = load_font(19)
FONT_MD = load_font(24)
FONT_LG = load_font(32, bold=True)
FONT_XL = load_font(42, bold=True)


def round_rect(draw, box, fill, outline=BORDER, radius=18, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def text(draw, xy, value, font=FONT_SM, fill=TEXT):
    draw.text(xy, value, font=font, fill=fill)


def chip(draw, xy, label, fill, text_fill=TEXT):
    x, y = xy
    w = 14 + draw.textlength(label, font=FONT_XS) + 14
    h = 32
    draw.rounded_rectangle((x, y, x + w, y + h), radius=16, fill=fill)
    draw.text((x + 14, y + 7), label, font=FONT_XS, fill=text_fill)
    return w


def scenario_button(draw, x, y, label, active=False, tone="zinc"):
    colors = {
        "emerald": ("#052e2b", "#065f46", "#d1fae5"),
        "rose": ("#4c0519", "#9f1239", "#fecdd3"),
        "amber": ("#451a03", "#92400e", "#fde68a"),
        "zinc": ("#27272a", "#3f3f46", "#f4f4f5"),
    }
    bg, outline, fg = colors[tone]
    width = 20 + draw.textlength(label, font=FONT_SM) + 20
    draw.rounded_rectangle((x, y, x + width, y + 40), radius=12, fill=bg, outline=outline, width=2)
    if active:
        draw.rounded_rectangle((x - 2, y - 2, x + width + 2, y + 42), radius=14, outline=WHITE, width=2)
    draw.text((x + 18, y + 10), label, font=FONT_SM, fill=fg)
    return width


def draw_header(draw):
    round_rect(draw, (30, 24, WIDTH - 30, 140), PANEL, radius=22)
    text(draw, (58, 48), "TRUSTED BROWSER", FONT_XS, MUTED)
    text(draw, (58, 70), "One-window hostile page vs trust response demo", FONT_XL, WHITE)
    text(
        draw,
        (58, 118),
        "Click a protocol scenario and the main preview swaps from the raw hostile page to the relay response.",
        FONT_SM,
        MUTED,
    )


def draw_controls(draw, active_label):
    round_rect(draw, (30, 156, WIDTH - 30, 300), PANEL, radius=22)
    text(draw, (58, 178), "Target URL", FONT_XS, MUTED)
    round_rect(draw, (58, 202, 455, 246), BG, radius=12)
    text(draw, (76, 214), "http://172.20.10.249:3001/", FONT_SM)

    text(draw, (490, 178), "Intent", FONT_XS, MUTED)
    round_rect(draw, (490, 202, 1125, 246), BG, radius=12)
    text(
        draw,
        (508, 214),
        "Find the clean product list without interacting with popups or human-check traps.",
        FONT_SM,
    )

    text(draw, (1160, 178), "Amount (USD)", FONT_XS, MUTED)
    round_rect(draw, (1160, 202, 1340, 246), BG, radius=12)
    text(draw, (1178, 214), "68", FONT_SM)

    buttons = [
        ("All Trust Layers", "emerald"),
        ("No Passport", "rose"),
        ("No Stake", "amber"),
        ("Forge Claims", "zinc"),
        ("Forge Proof", "zinc"),
        ("Tamper Action", "zinc"),
    ]
    cursor_x = 58
    for label, tone in buttons:
        w = scenario_button(draw, cursor_x, 256, label, active=(label == active_label), tone=tone)
        cursor_x += w + 12


def draw_raw_page(draw, box):
    x1, y1, x2, y2 = box
    round_rect(draw, box, PANEL, radius=22)
    text(draw, (x1 + 24, y1 + 18), "Live Preview", FONT_XS, MUTED)
    text(draw, (x1 + 24, y1 + 42), "Raw hostile website", FONT_MD, WHITE)
    inner = (x1 + 18, y1 + 86, x2 - 18, y2 - 18)
    round_rect(draw, inner, "#fafaf9", outline="#d4d4d8", radius=12)
    ix1, iy1, ix2, iy2 = inner
    draw.rectangle((ix1 + 26, iy1 + 26, ix2 - 26, iy1 + 88), fill="#e4e4e7")
    text(draw, (ix1 + 40, iy1 + 42), "PopUpMart | Agent Passport Target Demo", FONT_MD, "#18181b")
    text(draw, (ix1 + 40, iy1 + 90), "Compare the hostile page with the trusted clean lane.", FONT_SM, "#3f3f46")

    for i in range(3):
        card_x = ix1 + 42 + i * 235
        draw.rounded_rectangle((card_x, iy1 + 160, card_x + 190, iy1 + 330), radius=18, fill="#f4f4f5", outline="#d4d4d8")
        text(draw, (card_x + 18, iy1 + 182), f"Product {i + 1}", FONT_SM, "#18181b")
        text(draw, (card_x + 18, iy1 + 214), "$19.00", FONT_MD, "#18181b")
        draw.rounded_rectangle((card_x + 18, iy1 + 274, card_x + 160, iy1 + 308), radius=16, fill="#18181b")
        text(draw, (card_x + 38, iy1 + 282), "Click here maybe?", FONT_XS, "#fafafa")

    draw.rounded_rectangle((ix1 + 410, iy1 + 128, ix1 + 778, iy1 + 398), radius=20, fill="#fff1f2", outline="#fb7185", width=3)
    text(draw, (ix1 + 438, iy1 + 158), "Popup ad", FONT_LG, "#9f1239")
    text(draw, (ix1 + 438, iy1 + 214), "Continue as human", FONT_MD, "#4c0519")
    draw.rounded_rectangle((ix1 + 438, iy1 + 260, ix1 + 696, iy1 + 308), radius=16, fill="#fb7185")
    text(draw, (ix1 + 486, iy1 + 274), "Subscribe", FONT_SM, WHITE)

    draw.rounded_rectangle((ix1 + 510, iy1 + 436, ix1 + 860, iy1 + 584), radius=18, fill="#111827", outline="#93c5fd", width=2)
    text(draw, (ix1 + 538, iy1 + 468), "Human check required", FONT_MD, WHITE)
    text(draw, (ix1 + 538, iy1 + 512), "Continue as human", FONT_SM, "#cbd5e1")


def draw_response_page(draw, box, status, removed, fail_reason=None):
    x1, y1, x2, y2 = box
    round_rect(draw, box, PANEL, radius=22)
    text(draw, (x1 + 24, y1 + 18), "Live Preview", FONT_XS, MUTED)
    title = "Trusted clean relay output" if status == "pass" else "Blocked relay response"
    text(draw, (x1 + 24, y1 + 42), title, FONT_MD, WHITE)
    inner = (x1 + 18, y1 + 86, x2 - 18, y2 - 18)
    round_rect(draw, inner, BG, radius=12)
    ix1, iy1, ix2, iy2 = inner

    tone_fill = GREEN_BG if status == "pass" else RED_BG
    tone_border = GREEN if status == "pass" else RED
    badge = "Trusted" if status == "pass" else "Blocked"
    message = (
        "The trust bundle passed, so popup ads and click traps were stripped automatically."
        if status == "pass"
        else "The relay rejected the request before the clean lane could render."
    )

    draw.rounded_rectangle((ix1 + 26, iy1 + 24, ix2 - 26, iy1 + 170), radius=20, fill=tone_fill, outline=tone_border, width=2)
    chip(draw, (ix1 + 48, iy1 + 46), badge, tone_border, WHITE)
    text(draw, (ix1 + 48, iy1 + 92), "Trusted relay response" if status == "pass" else "Relay rejected the request", FONT_LG, WHITE)
    text(draw, (ix1 + 48, iy1 + 134), message, FONT_SM, "#e5e7eb")

    draw.rounded_rectangle((ix1 + 26, iy1 + 194, ix2 - 26, iy1 + 290), radius=18, fill=PANEL_ALT, outline=BORDER)
    text(draw, (ix1 + 46, iy1 + 214), "Removed interference", FONT_XS, MUTED)
    cursor = ix1 + 46
    for label in removed:
        w = chip(draw, (cursor, iy1 + 240), label, "#27272a")
        cursor += w + 10

    draw.rounded_rectangle((ix1 + 26, iy1 + 316, ix2 - 26, iy2 - 26), radius=18, fill=PANEL_ALT, outline=BORDER)
    text(draw, (ix1 + 46, iy1 + 336), "Verification snapshot", FONT_XS, MUTED)
    if status == "pass":
        text(draw, (ix1 + 46, iy1 + 386), "No failed verification steps to show.", FONT_SM, MUTED)
        draw.rounded_rectangle((ix1 + 46, iy1 + 430, ix2 - 46, iy1 + 560), radius=16, fill="#052e2b", outline="#065f46")
        text(draw, (ix1 + 70, iy1 + 460), "Trusted action accepted", FONT_MD, WHITE)
        text(draw, (ix1 + 70, iy1 + 504), "The relay fetched the hostile page and rendered a clean operator-safe view.", FONT_SM, "#d1fae5")
    else:
        draw.rounded_rectangle((ix1 + 46, iy1 + 386, ix2 - 46, iy1 + 540), radius=16, fill="#3f0d1f", outline="#9f1239")
        text(draw, (ix1 + 70, iy1 + 418), fail_reason[0], FONT_MD, WHITE)
        text(draw, (ix1 + 70, iy1 + 460), fail_reason[1], FONT_SM, "#fecdd3")


def draw_right_panel(draw, box, status, result_code, fail_reason=None):
    x1, y1, x2, y2 = box
    result_fill = "#052e2b" if status == "pass" else PANEL
    result_outline = "#065f46" if status == "pass" else BORDER
    round_rect(draw, (x1, y1, x2, y1 + 190), result_fill, outline=result_outline, radius=22)
    text(draw, (x1 + 24, y1 + 20), "Final Result", FONT_XS, MUTED)
    text(
        draw,
        (x1 + 24, y1 + 54),
        "Popup ads stripped automatically" if status == "pass" else "Relay blocked the clean lane",
        FONT_LG,
        WHITE,
    )
    badge_fill = "#064e3b" if status == "pass" else "#4c0519"
    badge_fg = "#a7f3d0" if status == "pass" else "#fecdd3"
    chip(draw, (x2 - 220, y1 + 22), result_code, badge_fill, badge_fg)
    message = (
        "Trusted headers unlocked the clean relay response."
        if status == "pass"
        else fail_reason[1]
    )
    text(draw, (x1 + 24, y1 + 114), message, FONT_SM, "#e4e4e7")

    round_rect(draw, (x1, y1 + 214, x2, y2), PANEL, radius=22)
    chip(draw, (x1 + 24, y1 + 232), "Verification", "#27272a")
    chip(draw, (x1 + 160, y1 + 232), "Trust Bundle", "#111827")

    if status == "pass":
        steps = [
            ("Passport active", "pass", "The passport resolved and passed the active check."),
            ("Claims verified", "pass", "Signed JSON-LD claims matched developer and model metadata."),
            ("Session scope valid", "pass", "Delegated session key stayed inside the allowed scope."),
            ("Intent proof valid", "pass", "Intent and action hashes stayed bound to the original command."),
        ]
    else:
        steps = [
            (fail_reason[0], "fail", fail_reason[1]),
            ("Trust bundle rejected", "fail", "The relay kept the hostile site in the blocked lane."),
        ]

    card_y = y1 + 286
    for title, state, detail in steps:
        fill = "#052e2b" if state == "pass" else "#3f0d1f"
        outline = "#065f46" if state == "pass" else "#9f1239"
        round_rect(draw, (x1 + 24, card_y, x2 - 24, card_y + 112), fill, outline=outline, radius=18)
        text(draw, (x1 + 44, card_y + 18), title, FONT_MD, WHITE)
        text(draw, (x1 + 44, card_y + 56), detail, FONT_XS, "#e4e4e7")
        card_y += 128

    bundle_y = y1 + 286
    bundle_x = x1 + 24
    bundle = [
        "X-Agent-Passport-ID",
        "X-Agent-Session-Grant",
        "X-Agent-Claims",
        "X-Agent-Intent-Hash",
        "X-Agent-Action-Hash",
    ]
    for label in bundle:
        draw.rounded_rectangle((bundle_x, bundle_y, x2 - 24, bundle_y + 62), radius=14, fill="#0a0a0d", outline=BORDER)
        text(draw, (bundle_x + 18, bundle_y + 12), label, FONT_XS, MUTED)
        text(draw, (bundle_x + 18, bundle_y + 32), "present" if status == "pass" else "check response panel", FONT_XS, TEXT if status == "pass" else MUTED)
        bundle_y += 74


def draw_scene(active_label, status, result_code, fail_reason=None):
    image = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(image)
    draw_header(draw)
    draw_controls(draw, active_label)

    left_box = (30, 324, 1040, 868)
    right_box = (1060, 324, WIDTH - 30, 868)

    if active_label == "Original":
        draw_raw_page(draw, left_box)
        draw_right_panel(
            draw,
            right_box,
            "fail",
            "pending",
            ("Choose a scenario", "The page is still showing the raw hostile site. Click a protocol button to run the trust relay."),
        )
    else:
        removed = [
            "aside.popup",
            ".modal-backdrop",
            ".human-check",
            "button:Click here maybe?",
        ]
        draw_response_page(draw, left_box, status, removed if status == "pass" else [], fail_reason=fail_reason)
        draw_right_panel(draw, right_box, status, result_code, fail_reason=fail_reason)

    return image


frames = [
    draw_scene("Original", "fail", "pending"),
    draw_scene("All Trust Layers", "pass", "trusted_action_accepted"),
    draw_scene(
        "No Passport",
        "fail",
        "captcha_required",
        ("Required headers missing", "The hostile site did not receive a complete wallet trust bundle, so the relay blocked the clean lane."),
    ),
    draw_scene(
        "Tamper Action",
        "fail",
        "invalid_intent_proof",
        ("Action hash mismatch", "The current action no longer matches the original trusted command, so the relay refused the request."),
    ),
    draw_scene("All Trust Layers", "pass", "trusted_action_accepted"),
]

durations = [1200, 1400, 1400, 1400, 1400]
frames[0].save(
    OUT_GIF,
    save_all=True,
    append_images=frames[1:],
    duration=durations,
    loop=0,
    disposal=2,
)

print(f"Saved {OUT_GIF}")
