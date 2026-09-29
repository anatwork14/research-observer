#!/usr/bin/env bash

verify_synctex_reverse_output() {
  local output="$1"
  local expected_source="$2"
  local input line actual_path expected_path

  input="$(printf '%s\n' "$output" | awk -F: '$1 == "Input" {sub(/^[[:space:]]+/, "", $2); print $2; exit}')"
  line="$(printf '%s\n' "$output" | awk -F: '$1 == "Line" {sub(/^[[:space:]]+/, "", $2); print $2; exit}')"
  [[ "$line" =~ ^[0-9]+$ && "$line" -ge 1 ]] || return 1

  actual_path="$(realpath "$input" 2>/dev/null)" || return 1
  expected_path="$(realpath "$expected_source" 2>/dev/null)" || return 1
  [[ "$actual_path" == "$expected_path" ]]
}
