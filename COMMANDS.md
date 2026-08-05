# Comandi del bot

Elenco di tutti gli slash command disponibili, divisi per feature. "[Admin]" indica che serve il permesso **Manage Roles** (o **Administrator** dove specificato).

---

## 🎂 Compleanni — `/birthday`

| Comando | Descrizione |
|---|---|
| `/birthday add day month [year] [user]` | Aggiunge/aggiorna il proprio compleanno. Con `user` (solo admin) lo imposta per qualcun altro. |
| `/birthday remove [user]` | Rimuove il proprio compleanno. Con `user` (solo admin) rimuove quello di qualcun altro. |
| `/birthday config [role] [removeafter] [channel]` | [Admin] Configura il ruolo assegnato il giorno del compleanno, dopo quanto rimuoverlo (es. `30s`, `10m`, `24h`, `3d`) e il canale per gli auguri. |
| `/birthday list` | Mostra tutti i compleanni del server, raggruppati per mese. |

Ogni giorno il bot assegna automaticamente il ruolo compleanno a chi festeggia, invia gli auguri nel canale configurato, e rimuove il ruolo dopo il tempo impostato.

---

## 🎬 Mystery Anime Night — `/animenight`

| Comando | Descrizione |
|---|---|
| `/animenight add titles [date]` | [Admin] Aggiunge uno o più anime alla lista visti (titoli separati da virgola o `/`). Data opzionale, default oggi. |
| `/animenight list [order]` | Mostra la lista completa degli anime visti, raggruppati per sessione. |
| `/animenight last` | Mostra gli anime dell'ultima sessione. |
| `/animenight edit session [titles] [date]` | [Admin] Modifica una sessione esistente (titoli e/o data). |

---

## ✅ Verifica utenti — `/verify`

| Comando | Descrizione |
|---|---|
| `/verify config` | [Admin] Configura i ruoli da assegnare per sub/domme/maledom, il ruolo condiviso da rimuovere, il canale dei report e un ruolo extra autorizzato a usare i comandi di verifica. |
| `/verify sub user verification` | [Admin] Verifica un utente come Sub: assegna il ruolo, rimuove l'eventuale ruolo configurato, posta un report. |
| `/verify domme user verification social` | [Admin] Come sopra, per Domme (include il campo Social). |
| `/verify maledom user verification social` | [Admin] Come sopra, per Maledom (include il campo Social). |
| `/verify edit user` | [Admin] Modifica i campi Verification/Social dell'ultimo report di un utente. |

Se un utente aveva già un report precedente, quello vecchio viene sostituito dal nuovo.

---

## 📌 Messaggi fissi — `/sticky`

| Comando | Descrizione |
|---|---|
| `/sticky add channel message` | [Admin] Imposta (o sostituisce) il messaggio fisso di un canale. |
| `/sticky remove channel` | [Admin] Rimuove il messaggio fisso da un canale. |
| `/sticky list` | Mostra tutti i messaggi fissi configurati nel server. |

Il messaggio viene ripostato in fondo al canale dopo ogni nuovo messaggio (cancellando quello vecchio, con 10 secondi di attesa tra la cancellazione e il repost).

---

## 💡 Suggerimenti — `/suggestion`

| Comando | Descrizione |
|---|---|
| `/suggestion add text` | Invia un nuovo suggerimento. |
| `/suggestion edit number text` | Modifica un proprio suggerimento ancora in attesa. |
| `/suggestion list` | Mostra tutti i suggerimenti in attesa di decisione. |
| `/suggestion approve number` | [Admin] Approva un suggerimento. |
| `/suggestion reject number` | [Admin] Rifiuta un suggerimento. |
| `/suggestion channel set channel` | [Admin] Imposta il canale dove postare i suggerimenti. |
| `/suggestion channel remove` | [Admin] Rimuove il canale configurato. |

---

## 🔎 Ricerca combinata ruoli — `/comboroles`

| Comando | Descrizione |
|---|---|
| `/comboroles role1 [role2] [role3] [role4] [role5] [but1] [but2] [but3]` | Mostra gli utenti che hanno **tutti** i ruoli indicati, escludendo (con `but1`-`but3`) chi ha anche uno di quei ruoli. Risultato paginato. |

---

## 🪧 Giorni dall'ultimo incidente — `/incident`

Richiede permesso **Administrator**.

| Comando | Descrizione |
|---|---|
| `/incident channel channel` | Imposta il canale dove tenere aggiornato il cartello "Days since last incident". |
| `/incident setnumber numero` | Imposta manualmente il contatore a un numero specifico. |
| `/incident reset` | Azzera il contatore (da usare quando è appena successo un incidente). |

Il contatore aumenta automaticamente di 1 ogni giorno a mezzanotte; viene mantenuto un solo messaggio visibile alla volta.

---

## 🚀 Ruoli personalizzati booster — `/boosterlink`

| Comando | Descrizione |
|---|---|
| `/boosterlink link user role` | Collega un ruolo personalizzato a un booster. |
| `/boosterlink unlink user [role]` | Scollega un ruolo specifico, o **tutti** quelli dell'utente se `role` viene omesso. |
| `/boosterlink list [user]` | Elenca i collegamenti attivi, opzionalmente filtrati per utente. |
| `/boosterlink toggle enabled` | Abilita/disabilita con un solo comando la rimozione automatica per l'intero server. |

Quando un utente perde il ruolo Booster di Discord (scadenza, rimozione manuale, ecc.), tutti i ruoli personalizzati collegati a lui vengono rimossi automaticamente. Gli utenti con il ruolo `1090658915810820156` sono sempre esclusi da questa rimozione.

---

## 🔗 Collegamento tra due ruoli — `/rolelink`

Versione generica dello stesso meccanismo, non legata al boost.

| Comando | Descrizione |
|---|---|
| `/rolelink link role1 role2 [viceversa]` | Collega ruolo1 → ruolo2: perdere ruolo1 rimuove ruolo2. Con `viceversa:true` vale anche il contrario. |
| `/rolelink unlink role1 role2` | Rimuove un collegamento (stesso ordine usato alla creazione). |
| `/rolelink list` | Elenca tutti i collegamenti configurati nel server. |
| `/rolelink toggle enabled` | Abilita/disabilita con un solo comando la rimozione automatica per l'intero server. |
