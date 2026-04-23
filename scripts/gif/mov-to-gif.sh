#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") <input.mov> [output.gif] [options]

Options:
  --fps N       frames per second (default: 15)
  --width N     output width in pixels, preserves aspect ratio (default: 800)
  --ss TIME     trim start time (e.g. 0:02, 30)
  --t DURATION  clip duration in seconds (e.g. 10)
  -h, --help    show this help

Converts a .mov screen recording to an optimized animated GIF using
ffmpeg's two-pass palettegen/paletteuse pipeline.

Examples:
  $(basename "$0") demo.mov
  $(basename "$0") demo.mov out.gif --fps 10 --width 600
  $(basename "$0") demo.mov --ss 0:05 --t 8
EOF
}

ensure_ffmpeg() {
  if command -v ffmpeg >/dev/null 2>&1; then
    return
  fi
  echo "ffmpeg not found."
  if [[ "$(uname)" == "Darwin" ]] && command -v brew >/dev/null 2>&1; then
    echo "Installing ffmpeg via Homebrew..."
    brew install ffmpeg
  else
    echo "Please install ffmpeg: https://ffmpeg.org/download.html"
    exit 1
  fi
}

input=""
output=""
fps=15
width=800
ss=""
t=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)   usage; exit 0;;
    --fps)       fps="$2"; shift 2;;
    --width)     width="$2"; shift 2;;
    --ss)        ss="$2"; shift 2;;
    --t)         t="$2"; shift 2;;
    -*)          echo "unknown option: $1" >&2; usage >&2; exit 1;;
    *)
      if [[ -z "$input" ]]; then
        input="$1"
      elif [[ -z "$output" ]]; then
        output="$1"
      else
        echo "too many arguments" >&2; exit 1
      fi
      shift;;
  esac
done

if [[ -z "$input" ]]; then
  echo "error: input file required" >&2
  usage >&2
  exit 1
fi

if [[ ! -f "$input" ]]; then
  echo "error: file not found: $input" >&2
  exit 1
fi

[[ -z "$output" ]] && output="${input%.*}.gif"

ensure_ffmpeg

palette="$(mktemp).png"
trap 'rm -f "$palette"' EXIT

# Build base args array upfront to avoid empty-array unbound-variable errors
# on macOS's bash 3.2 which treats "${arr[@]}" on empty arrays as unbound with set -u.
args=(-y)
[[ -n "$ss" ]] && args+=(-ss "$ss")
[[ -n "$t" ]]  && args+=(-t "$t")

filter="fps=${fps},scale=${width}:-1:flags=lanczos"

echo "==> [1/2] building palette"
ffmpeg "${args[@]}" -i "$input" \
  -vf "${filter},palettegen=stats_mode=diff" \
  -update 1 "$palette" -loglevel warning

echo "==> [2/2] encoding gif"
ffmpeg "${args[@]}" -i "$input" -i "$palette" \
  -lavfi "${filter}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5" \
  "$output" -loglevel warning

echo "done: $output"
