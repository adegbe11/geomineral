import base64
import binascii
import io
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError


def normalize_photo(value: str) -> str:
    """Bound decoded images and strip EXIF/location metadata before persistence or AI."""
    if len(value) > 3_000_000 or not value.startswith(
        ("data:image/jpeg;base64,", "data:image/png;base64,", "data:image/webp;base64,")
    ):
        raise ValueError("Choose a JPEG, PNG or WebP photo under 2 MB.")
    try:
        raw = base64.b64decode(value.split(",", 1)[1], validate=True)
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as original:
                if original.width * original.height > 25_000_000:
                    raise ValueError("Photo resolution is too large.")
                photo = ImageOps.exif_transpose(original).convert("RGB")
                photo.thumbnail((1280, 1280))
                clean = Image.new("RGB", photo.size)
                clean.paste(photo)
                output = io.BytesIO()
                clean.save(output, format="JPEG", quality=85)
        return "data:image/jpeg;base64," + base64.b64encode(output.getvalue()).decode()
    except (
        binascii.Error,
        OSError,
        UnidentifiedImageError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ) as exc:
        raise ValueError("Photo could not be read.") from exc
