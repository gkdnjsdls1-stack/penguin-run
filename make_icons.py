"""앱 아이콘 생성기. 수정하고 `python3 make_icons.py` 다시 실행하면 전 사이즈가 다시 나온다."""
from PIL import Image, ImageDraw

S = 2048                      # 작업 해상도 (다운스케일로 계단 제거)
k = S / 1024.0                # 1024 기준 좌표를 쓰기 위한 배율
def u(*v): return [x * k for x in v]

SKY_TOP, SKY_BOT = (0x7F, 0xC2, 0xE6), (0xCF, 0xEB, 0xF8)
SNOW = (0xEC, 0xF7, 0xFD)
BLACK, GRAY, WING, CREAM, INK = (0x23, 0x27, 0x2E), (0xC6, 0xCB, 0xD1), (0xA6, 0xAD, 0xB5), (0xF6, 0xF3, 0xEC), (0x1A, 0x1D, 0x22)
GOLD = (0xF2, 0xAE, 0x1F)

img = Image.new("RGB", (S, S))
d = ImageDraw.Draw(img)
for y in range(S):                       # 하늘 그라데이션
    t = y / (S - 1)
    d.line([(0, y), (S, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(SKY_TOP, SKY_BOT)))

d.ellipse(u(-180, 796, 1204, 1400), fill=SNOW)   # 눈 언덕 (작은 크기에선 아래쪽 밝은 띠로 읽힘)

def blob(box, fill, angle=0):
    """회전이 필요한 타원은 따로 그려서 합성한다 (ImageDraw는 타원 회전을 지원하지 않음)."""
    if not angle:
        d.ellipse(u(*box), fill=fill); return
    x0, y0, x1, y1 = u(*box)
    w, h = int(x1 - x0), int(y1 - y0)
    pad = int(max(w, h) * 0.5)
    lay = Image.new("RGBA", (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    ImageDraw.Draw(lay).ellipse([pad, pad, pad + w, pad + h], fill=fill)
    lay = lay.rotate(angle, resample=Image.BICUBIC, expand=False)
    img.paste(lay, (int(x0) - pad, int(y0) - pad), lay)

# 마스커블 안전영역: 중심 (512,512) 반지름 410 원 안에 모든 요소를 둔다
blob((448, 858, 512, 902), GOLD)                # 발
blob((512, 858, 576, 902), GOLD)
blob((262, 556, 392, 816), WING, angle=16)      # 날개 (몸통보다 어둡게 해야 읽힌다)
blob((632, 556, 762, 816), WING, angle=-16)
blob((300, 486, 724, 882), GRAY)                # 몸통
blob((322, 168, 702, 568), BLACK)               # 머리
blob((386, 272, 638, 536), CREAM)               # 얼굴
for ex in (452, 572):                           # 눈
    blob((ex - 31, 356, ex + 31, 422), INK)
    blob((ex + 5, 367, ex + 25, 389), (255, 255, 255))
d.polygon(u(512, 512, 476, 452, 548, 452), fill=(0x4A, 0x50, 0x59))   # 부리

for n in (512, 192, 180, 32):
    img.resize((n, n), Image.LANCZOS).save(f"icon-{n}.png", optimize=True)
    print(f"icon-{n}.png")
