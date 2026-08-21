#!/usr/bin/env python3
"""Build deterministic responsive derivatives from canonical Bunker PNGs."""

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps


PROJECT_ROOT = Path(__file__).resolve().parents[1]
IMAGE_ROOT = PROJECT_ROOT / "public" / "images" / "bunker"


@dataclass(frozen=True)
class Asset:
    stem: str
    widths: tuple[int, ...]
    avif_quality: int
    webp_quality: int


ASSETS = (
    Asset("tunnel-relief-wide", (960, 1920), 48, 72),
    Asset("tunnel-relief-mobile", (480, 960), 52, 74),
    Asset("train-tunnel", (960, 1920), 48, 72),
    Asset("bunker-exterior", (960, 1920), 48, 72),
    Asset("bunker-door-closed", (960, 1920), 48, 72),
    Asset("bunker-door-open", (960, 1920), 48, 72),
    Asset("evidence-01", (480, 960), 52, 74),
    Asset("evidence-02", (480, 960), 52, 74),
    Asset("evidence-03", (480, 960), 52, 74),
    Asset("evidence-04", (480, 960), 52, 74),
    Asset("evidence-05", (480, 960), 52, 74),
    Asset("evidence-06", (480, 960), 52, 74),
    Asset("tunnel-map-master", (960, 1920), 48, 72),
    Asset("archive-bk17", (480, 960), 52, 74),
    Asset("archive-card", (480, 960), 52, 74),
    Asset("archive-document", (480, 960), 52, 74),
)


def resized(image: Image.Image, width: int) -> Image.Image:
    height = round(image.height * width / image.width)
    if height % 2:
        height -= 1
    return image.resize((width, height), Image.Resampling.LANCZOS)


def save_verified(variant: Image.Image, output_path: Path, **save_options: object) -> None:
    """Encode beside the destination, decode fully, then publish atomically."""
    temporary_path = output_path.with_name(f".{output_path.name}.task8-tmp")
    try:
        variant.save(temporary_path, **save_options)
        if temporary_path.stat().st_size == 0:
            raise RuntimeError(f"Encoder produced an empty file: {temporary_path}")
        with Image.open(temporary_path) as encoded:
            encoded.load()
        temporary_path.replace(output_path)
    finally:
        temporary_path.unlink(missing_ok=True)


def build_asset(asset: Asset) -> None:
    source_path = IMAGE_ROOT / f"{asset.stem}.png"
    if not source_path.is_file():
        raise FileNotFoundError(f"Missing canonical Bunker image: {source_path}")

    with Image.open(source_path) as opened:
        canonical = ImageOps.exif_transpose(opened)
        canonical.load()

        for width in asset.widths:
            if width > canonical.width:
                raise ValueError(f"Refusing to upscale {source_path} to {width}px")

            variant = resized(canonical, width)
            avif_path = IMAGE_ROOT / f"{asset.stem}-{width}.avif"
            webp_path = IMAGE_ROOT / f"{asset.stem}-{width}.webp"

            save_verified(
                variant,
                avif_path,
                format="AVIF",
                quality=asset.avif_quality,
                speed=6,
                max_threads=1,
                autotiling=False,
            )
            save_verified(
                variant,
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
                f"{asset.stem}: {variant.width}x{variant.height} -> "
                f"{avif_path.name} ({avif_path.stat().st_size} B), "
                f"{webp_path.name} ({webp_path.stat().st_size} B)"
            )


def main() -> None:
    for asset in ASSETS:
        build_asset(asset)

    # Re-open the complete delivery set after all encoders have closed. This
    # catches interrupted writes and prevents a partially published asset set.
    for asset in ASSETS:
        for width in asset.widths:
            for extension in ("avif", "webp"):
                output_path = IMAGE_ROOT / f"{asset.stem}-{width}.{extension}"
                if output_path.stat().st_size == 0:
                    raise RuntimeError(f"Published an empty file: {output_path}")
                with Image.open(output_path) as encoded:
                    encoded.load()


if __name__ == "__main__":
    main()
