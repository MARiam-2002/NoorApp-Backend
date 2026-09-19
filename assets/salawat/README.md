# Salawat audio drop-in folder

Place CC0 MP3 files here to enable vocal clips in `GET /api/v1/salawat/audio`:

| File | Catalog id | Source |
|------|------------|--------|
| `salli_ala_muhammad.mp3` | `salli_ala_muhammad` | Freesound 788917 (CC0, ibrahim_baig) |
| `laa_tansi_salli_ala_muhammad.mp3` | `laa_tansi_salli_ala_muhammad` | Freesound 788912 (CC0, ibrahim_baig) |

Until those files exist, the catalog still returns the metadata (`available: false`) and rotates among hosted CC0 peaceful tones (`notification/meditation_bell.mp3`, `notification/soft_chime.mp3`).
