#!/bin/bash
# Removes MediaDrop from this Mac: the app and its Premiere Pro panel. Downloaded media is always kept.
# Run by double-clicking "Uninstall MediaDrop.command" (release zip), which asks whether to also delete
# settings and saved logins, or by MediaDrop's Settings > Uninstall, which passes --remove-data or
# --keep-data. A copy lives in MediaDrop.app/Contents/Resources, so everything runs inside main():
# bash reads the whole file before deleting the app that contains it.

main() {
  local app="/Applications/MediaDrop.app"
  local panel="$HOME/Library/Application Support/Adobe/CEP/extensions/MediaDropBackend"
  local remove_data=""
  case "$1" in
    --remove-data) remove_data=1 ;;
    --keep-data) remove_data=0 ;;
  esac

  if [ -z "$remove_data" ]; then
    echo "=================================================="
    echo "          MediaDrop Uninstaller for macOS"
    echo "=================================================="
    echo "Removes MediaDrop and its Premiere Pro panel. Your downloaded media stays where it is."
    echo ""
    read -r -p "Also delete MediaDrop's settings and saved logins? [y/N] " answer
    if [[ "$answer" =~ ^[Yy] ]]; then remove_data=1; else remove_data=0; fi
  fi

  # MediaDrop's Uninstall button quits it before this runs; give it a moment, then close what's left
  # (the app, and yt-dlp or ffmpeg from inside it), but never this script
  local running="$app/Contents/(MacOS|Resources/(yt-dlp|bin))/"
  for _ in $(seq 20); do pgrep -f "$running" >/dev/null || break; sleep 0.5; done
  pkill -f "$running" 2>/dev/null && sleep 1

  rm -rf "$app" "$panel"
  echo "  ✓ Removed MediaDrop and its Premiere Pro panel"

  if [ "$remove_data" = 1 ]; then
    rm -rf "$HOME/Library/Application Support/mediadrop" \
      "$HOME/Library/Preferences/com.mediadrop.app.plist" \
      "$HOME/Library/Saved Application State/com.mediadrop.app.savedState" \
      "$HOME/Library/Caches/com.mediadrop.app" \
      "$HOME/Library/Caches/mediadrop"
    # The key that encrypts saved logins
    security delete-generic-password -s "MediaDrop Safe Storage" >/dev/null 2>&1
    echo "  ✓ Deleted settings and saved logins"
  fi

  echo ""
  echo "MediaDrop is uninstalled. Restart Premiere Pro if it's open."
}

main "$@"
exit
