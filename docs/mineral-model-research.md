# Free mineral vision review — 2026-09-16

The goal is visual mineral suggestions without paid inference. A mineral catalogue does not establish recognition coverage. These repositories were inspected as candidates, not adopted based on their names alone.

| Project | Evidence inspected | Decision |
| --- | --- | --- |
| [ai-forever/mineral-recognition](https://github.com/ai-forever/mineral-recognition) | MIT research implementation, CLIP-based zero-shot recognition, mineral dataset splits | Useful research; no ready validated replacement established in this review. |
| [zengxiang68/Mineral-Identification](https://github.com/zengxiang68/Mineral-Identification) | 36 classes, image and hardness training code, GPL-3.0 | Not a drop-in photo-only checkpoint. |
| [Nech-C/results](https://huggingface.co/Nech-C/results) | Model card reports 0.0422 accuracy; config has numeric class names | Rejected: insufficient results and no usable mineral label mapping. |
| [minatosnow/SwinV2 tiny mineral](https://huggingface.co/minatosnow/swinv2-tiny-patch4-window8-256-mineral) | 282 labels including varieties/groups; card reports 0.2467 evaluation accuracy; incomplete dataset documentation | Rejected as production replacement. Small and base versions report about 0.24–0.245. |
| [Qwen3-VL](https://github.com/QwenLM/Qwen3-VL) / [Ollama 2B distribution](https://ollama.com/library/qwen3-vl:2b) | Apache-2.0 local vision model, approximately 1.9 GB quantized weights | Installed for comparative smoke testing; general vision, not a scientifically validated mineral classifier. |

The local structured adapter accepts a model-suggested mineral or rock name without the old fixed name whitelist. It enforces a JSON response contract and non-geological rejection, not scientific validity. No confidence percentage or deposit probability is derived from image output. Images are not sent to a cloud service. The main photo is examined; supporting images are saved with the record.

Run `scripts/compare-local-vision.py --model MODEL` with `PYTHONPATH=services/api` using the project Python environment. It compares an artificial non-rock control and locally downloaded reference photographs. Only image bytes are passed to the model, without reference labels. Results are saved in `.data/vision-smoke/MODEL-results.json`. This tiny set may overlap pretraining data and does not estimate field accuracy, rare-mineral coverage, or performance on weathered/mixed samples.
