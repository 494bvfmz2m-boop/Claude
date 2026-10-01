// Accounts van de beheerpagina. Wachtwoorden staan hier alleen als hash (niet terug te rekenen naar het wachtwoord).
// Nieuw bestand maken: log in als hoofdbeheerder → Beheerders → “Accounts opslaan als bestand”.
window.SITE_ADMINS = {
  "updated": "2026-10-01T11:02:34.487Z",
  "accounts": [
    {
      "email": "622521@nxt.eu",
      "role": "owner",
      "status": "active",
      "salt": "4be629f3dfa413d580f613891d6d2f0d",
      "iterations": 150000,
      "hash": "f9190e530e1d412c479e44f02ebc58ef6607f8cf0cb2f8acab72b287a953c543"
    },
    {
      "email": "622520@nxt.eu",
      "role": "admin",
      "status": "active",
      "mustChange": true,
      "salt": "4c288b51688b9e37001eedefd03c866d",
      "iterations": 150000,
      "hash": "80d5abfa2551e0c6cbc63700bcce121d8bbeb9b79a8e0d9302aba1c950595742"
    },
    {
      "email": "623174@nxt.eu",
      "role": "admin",
      "status": "active",
      "mustChange": true,
      "salt": "6bc892e48b4aee6be7d0bb04fd1a0e55",
      "iterations": 150000,
      "hash": "ef3c945577163606af0e483b4b93bddb21dbd9e9fab1493a141a0d2ad1a24958"
    }
  ]
};
