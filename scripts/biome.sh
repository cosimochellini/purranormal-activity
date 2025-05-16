#!/bin/bash

# A utility script for Biome operations

# Default action
ACTION="check"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --check)
      ACTION="check"
      shift
      ;;
    --fix)
      ACTION="check-fix"
      shift
      ;;
    --format)
      ACTION="format"
      shift
      ;;
    --apply)
      APPLY="--write"
      shift
      ;;
    *)
      TARGETS="$TARGETS $1"
      shift
      ;;
  esac
done

# Default target is the entire project
if [ -z "$TARGETS" ]; then
  TARGETS="."
fi

case $ACTION in
  "check")
    echo "🔍 Running Biome linter on $TARGETS"
    npx @biomejs/biome check $TARGETS
    ;;
  "check-fix")
    echo "🔧 Running Biome linter with fixes on $TARGETS"
    npx @biomejs/biome check --apply $TARGETS
    ;;
  "format")
    echo "✨ Formatting with Biome on $TARGETS"
    if [ -z "$APPLY" ]; then
      npx @biomejs/biome format $TARGETS
    else
      npx @biomejs/biome format $APPLY $TARGETS
    fi
    ;;
esac
