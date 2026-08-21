#!/usr/bin/env python3
"""Build deterministic responsive derivatives from the canonical Task 4 PNGs."""

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps


PROJECT_ROOT = Path(__file__).resolve().parents[1]
IMAGE_ROOT = PROJECT_ROOT / "public" / "images"


@dataclass(frozen=True)
class Asset:
    source: str
    widths: tuple[int, ...]
    avif_quality: int
    webp_quality: int


ASSETS = (
    Asset("ticket/locomotive-engraving.png", (480, 960), 58, 78),
    Asset("ticket/tyumen-skyline-engraving.png", (960, 1600), 58, 78),
    Asset("ticket/railway-seal.png", (128, 256), 62, 82),
    Asset("ticket/paper-texture.png", (512, 1024), 48, 72),
    Asset("wedding/train-arrival-wide.png", (960, 1920), 52, 76),
)


def resized(image: Image.Image, width: int) -> Image.Image:
    height = round(image.height * width / image.width)
    # Keep the AV1 encoder on chroma-safe dimensions while preserving the
    # requested intrinsic width used by each srcset descriptor.
    if height % 2:
        height -= 1
    return image.resize((width, height), Image.Resampling.LANCZOS)


def build_asset(asset: Asset) -> None:
    source_path = IMAGE_ROOT / asset.source
    if not source_path.is_file():
        raise FileNotFoundError(f"Missing canonical image: {source_path}")

    with Image.open(source_path) as opened:
        canonical = ImageOps.exif_transpose(opened)
        canonical.load()

        for width in asset.widths:
            if width > canonical.width:
                raise ValueError(f"Refusing to upscale {source_path} to {width}px")

            variant = resized(canonical, width)
            stem = source_path.with_suffix("")
            avif_path = stem.with_name(f"{stem.name}-{width}").with_suffix(".avif")
            webp_path = stem.with_name(f"{stem.name}-{width}").with_suffix(".webp")

            variant.save(
                avif_path,
                format="AVIF",
                quality=asset.avif_quality,
                speed=6,
                max_threads=1,
                autotiling=False,
            )
            variant.save(
                webp_path,
                format="WEBP",
                quality=asset.webp_quality,
                method=6,
                exact=True,
            )

            for output_path in (avif_path, webp_path):
                if output_path.stat().st_size == 0:
                    raise RuntimeError(f"Encoder produced an empty file: {output_path}")
                with Image.open(output_path) as encoded:
                    encoded.load()

            print(
                f"{asset.source}: {variant.width}x{variant.height} -> "
                f"{avif_path.name} ({avif_path.stat().st_size} B), "
                f"{webp_path.name} ({webp_path.stat().st_size} B)"
            )


def main() -> None:
    for asset in ASSETS:
        build_asset(asset)


if __name__ == "__main__":
    main()
