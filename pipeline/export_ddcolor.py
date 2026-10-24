"""Export DDColor (official weights, Apache-2.0) to ONNX with a fixed 512x512 input.

    uv run --extra export python export_ddcolor.py [--variant modelscope|artistic]

Clones github.com/piddnad/DDColor into .cache/ (for the model code), downloads the
weights from Hugging Face and writes models/ddcolor_<variant>_512.onnx.

ONNX graph:  input  "gray_rgb"  float32 [1, 3, 512, 512]  (L channel only, rendered as RGB, 0..1)
             output "ab"        float32 [1, 2, 512, 512]  (Lab a/b channels, OpenCV float Lab scale)
"""

import argparse
import subprocess
import sys
from pathlib import Path

import torch

HERE = Path(__file__).resolve().parent
REPO = HERE / ".cache" / "DDColor"
MODELS = HERE / "models"
SIZE = 512


def ensure_repo() -> None:
    if not (REPO / "ddcolor").exists():
        REPO.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["git", "clone", "--depth", "1", "https://github.com/piddnad/DDColor.git", str(REPO)],
            check=True,
        )
    sys.path.insert(0, str(REPO))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--variant", default="modelscope", choices=["modelscope", "artistic", "paper"])
    args = ap.parse_args()

    ensure_repo()
    from huggingface_hub import hf_hub_download

    from ddcolor import DDColor, build_ddcolor_model

    weights = hf_hub_download(f"piddnad/ddcolor_{args.variant}", "pytorch_model.bin")
    model = build_ddcolor_model(DDColor, model_path=weights, input_size=SIZE, model_size="large", device="cpu")

    MODELS.mkdir(exist_ok=True)
    out = MODELS / f"ddcolor_{args.variant}_{SIZE}.onnx"
    dummy = torch.rand(1, 3, SIZE, SIZE)
    with torch.no_grad():
        torch.onnx.export(
            model,
            (dummy,),
            str(out),
            input_names=["gray_rgb"],
            output_names=["ab"],
            opset_version=17,
            dynamo=False,
        )
    print(f"Saved {out} ({out.stat().st_size / 1e6:.0f} MB)")


if __name__ == "__main__":
    main()
