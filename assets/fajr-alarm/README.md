# Fajr wake-up recording

File: `fajr_wakeup_alarm_v1.mp3` (994816 bytes).
SHA-256: `77f64784a80c4f189bae24521f6e4433ac0f3f96fd5e31888277ce33fac5971f`.

User-selected source: https://www.youtube.com/watch?v=onvTvACwHCE
Uploader-linked MediaFire file ID: `1envp6kjb8fn8s3`.
Commercial redistribution rights and attribution have not been independently verified; do not describe this as a cleared license. The working default remains the system alarm sound.

Public delivery: `/api/v1/fajr-alarm/sounds` and `/api/v1/fajr-alarm/media/fajr_wakeup_alarm_v1.mp3` after deployment.
Flutter downloads and verifies this file before arming, then rings from persistent local storage; no runtime streaming at Fajr.
Keep the filename/content immutable. Use a new versioned filename and checksum for a different recording.
