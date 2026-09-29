#!/usr/bin/env bash
set -euo pipefail

required=(latexmk pdflatex xelatex lualatex bibtex biber synctex)
for command in "${required[@]}"; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "[verify:latex:toolchain] missing required command: $command" >&2
    exit 2
  fi
done

root="$(mktemp -d "${TMPDIR:-/tmp}/observaire-latex-shell-XXXXXX")"
trap 'rm -rf "$root"' EXIT
source "$(dirname "$0")/synctex-validation.sh"

cat >"$root/main.tex" <<'TEX'
\documentclass{article}
\usepackage[T1]{fontenc}
\begin{document}
\section{Smoke test}
Observaire LaTeX verification.\label{sec:smoke}
See Section~\ref{sec:smoke}.
\immediate\write18{touch observaire-shell-escape-must-not-run}
\end{document}
TEX

cat >"$root/references.bib" <<'BIB'
@misc{observaire2026,
  author = {Observaire Test},
  title = {Toolchain verification fixture},
  year = {2026}
}
BIB

cat >"$root/classic.tex" <<'TEX'
\documentclass{article}
\begin{document}
Classic BibTeX citation~\cite{observaire2026}.
\bibliographystyle{plain}
\bibliography{references}
\end{document}
TEX

cat >"$root/biblatex.tex" <<'TEX'
\documentclass{article}
\usepackage[backend=biber]{biblatex}
\addbibresource{references.bib}
\begin{document}
Biber citation~\cite{observaire2026}.
\printbibliography
\end{document}
TEX

common='-interaction=nonstopmode -file-line-error -synctex=1 -halt-on-error -no-shell-escape %O %S'

run_engine() {
  local engine="$1"
  local mode="$2"
  local option="$3"
  local out="$root/build-$engine"
  mkdir -p "$out"
  latexmk "$mode" -cd "-outdir=$out" "$option=$engine $common" "$root/main.tex"
  test -s "$out/main.pdf"
  test -s "$out/main.synctex.gz"
}

run_engine pdflatex -pdf -pdflatex
run_engine xelatex -xelatex -xelatex
run_engine lualatex -lualatex -lualatex

if [[ -e "$root/observaire-shell-escape-must-not-run" ]]; then
  echo "[verify:latex:toolchain] unrestricted shell escape executed unexpectedly" >&2
  exit 3
fi

mkdir -p "$root/build-classic"
latexmk -pdf -cd "-outdir=$root/build-classic" "-pdflatex=pdflatex $common" "$root/classic.tex"
test -s "$root/build-classic/classic.pdf"
test -s "$root/build-classic/classic.bbl"
grep -Fq 'Toolchain verification fixture' "$root/build-classic/classic.bbl"
if grep -Eiq 'Citation .+ undefined|There were undefined references' "$root/build-classic/classic.log"; then
  echo "[verify:latex:toolchain] classic BibTeX log contains unresolved citations/references" >&2
  exit 6
fi
classic_text="$(gs -q -dNOPAUSE -dBATCH -sDEVICE=txtwrite -sOutputFile=- "$root/build-classic/classic.pdf")"
if ! grep -Fq 'Observaire Test' <<<"$classic_text"; then
  echo "[verify:latex:toolchain] classic BibTeX citation/bibliography did not render in the PDF" >&2
  printf '%s\n' "$classic_text" >&2
  exit 6
fi

mkdir -p "$root/build-biblatex"
latexmk -pdf -cd "-outdir=$root/build-biblatex" "-pdflatex=pdflatex $common" "$root/biblatex.tex"
test -s "$root/build-biblatex/biblatex.pdf"
test -s "$root/build-biblatex/biblatex.bbl"
grep -Fq 'Toolchain verification fixture' "$root/build-biblatex/biblatex.bbl"
if grep -Eiq 'Citation .+ undefined|There were undefined references|Please (re)?run Biber' "$root/build-biblatex/biblatex.log"; then
  echo "[verify:latex:toolchain] biblatex/Biber log contains unresolved bibliography output" >&2
  exit 7
fi
biblatex_text="$(gs -q -dNOPAUSE -dBATCH -sDEVICE=txtwrite -sOutputFile=- "$root/build-biblatex/biblatex.pdf")"
if ! grep -Fq 'Observaire Test' <<<"$biblatex_text"; then
  echo "[verify:latex:toolchain] biblatex/Biber citation/bibliography did not render in the PDF" >&2
  printf '%s\n' "$biblatex_text" >&2
  exit 7
fi

forward="$(synctex view -i "5:0:$root/main.tex" -o "$root/build-pdflatex/main.pdf")"
page="$(printf '%s\n' "$forward" | awk -F: '$1 == "Page" {sub(/^[[:space:]]+/, "", $2); print $2; exit}')"
x="$(printf '%s\n' "$forward" | awk -F: '$1 == "x" {sub(/^[[:space:]]+/, "", $2); print $2; exit}')"
y="$(printf '%s\n' "$forward" | awk -F: '$1 == "y" {sub(/^[[:space:]]+/, "", $2); print $2; exit}')"

if [[ -z "$page" || -z "$x" || -z "$y" ]]; then
  echo "[verify:latex:toolchain] SyncTeX forward output did not contain Page/x/y" >&2
  printf '%s\n' "$forward" >&2
  exit 4
fi

reverse="$(synctex edit -o "$page:$x:$y:$root/build-pdflatex/main.pdf")"

if ! verify_synctex_reverse_output "$reverse" "$root/main.tex"; then
  echo "[verify:latex:toolchain] SyncTeX reverse output did not resolve to main.tex" >&2
  printf '%s\n' "$reverse" >&2
  exit 5
fi
line="$(printf '%s\n' "$reverse" | awk -F: '$1 == "Line" {sub(/^[[:space:]]+/, "", $2); print $2; exit}')"

first_line() {
  "$@" 2>&1 | sed -n '1p'
}

echo "[verify:latex:toolchain] PASS"
echo "latexmk: $(first_line latexmk -v)"
echo "pdflatex: $(first_line pdflatex --version)"
echo "xelatex: $(first_line xelatex --version)"
echo "lualatex: $(first_line lualatex --version)"
echo "bibtex: $(first_line bibtex --version)"
echo "biber: $(first_line biber --version)"
echo "synctex: $(first_line synctex --version)"
echo "classic BibTeX: PASS"
echo "biblatex/Biber: PASS"
echo "shell escape disabled: PASS"
echo "SyncTeX: main.tex:5 -> page=$page x=$x y=$y -> main.tex:$line"
