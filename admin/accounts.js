// Accounts van de beheerpagina. Wachtwoorden staan hier alleen als hash (niet terug te rekenen naar het wachtwoord).
// Nieuw bestand maken: log in als hoofdbeheerder → Beheerders → “Accounts opslaan als bestand”.
window.SITE_ADMINS = {
  "updated": "2026-10-01T11:06:38.506Z",
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
      "salt": "6d9b35f345625fc46bdd4d92550f2205",
      "iterations": 150000,
      "hash": "b2711379f53431e8fa151e9241da460886f5e4af8cb05519a7c8ffdf4d3368ad"
    }
  ]
};
