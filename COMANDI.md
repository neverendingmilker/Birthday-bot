# Comandi del bot

Guida rapida a cosa fa ogni comando. Nessun dettaglio tecnico, solo l'uso pratico.

## 🎂 Compleanni (`/birthday`)

- **`/birthday add`** — Salvi il tuo compleanno (giorno, mese e, se vuoi, l'anno). Un admin può usarlo per salvare il compleanno di qualcun altro.
- **`/birthday remove`** — Cancelli il tuo compleanno salvato. Un admin può rimuovere quello di qualcun altro.
- **`/birthday config`** — Solo admin. Imposta il ruolo da dare a chi festeggia, dopo quanto tempo toglierlo, e/o il canale dove postare gli auguri.
- **`/birthday list`** — Mostra tutti i compleanni del server, divisi per mese.

Il giorno del compleanno il bot assegna automaticamente il ruolo (se configurato) e posta un messaggio di auguri (se configurato un canale), poi toglie il ruolo dopo il tempo impostato.

## 📺 Anime Night (`/animenight`)

- **`/animenight add`** — Solo admin. Aggiunge uno o più anime visti in una serata (es. "Naruto, Bleach").
- **`/animenight list`** — Mostra la lista completa degli anime visti, divisa per serata.
- **`/animenight last`** — Mostra solo gli anime dell'ultima serata.
- **`/animenight edit`** — Solo admin. Modifica una serata già registrata (titoli e/o data).

## ✅ Verifica utenti (`/verify`)

Riservato agli admin.

- **`/verify config`** — Imposta i ruoli da assegnare per ciascun tipo di verifica (sub / domme / maledom), l'eventuale ruolo condiviso da rimuovere quando si verifica qualcuno, e il canale dove postare i report.
- **`/verify sub`**, **`/verify domme`**, **`/verify maledom`** — Verifica un utente come uno dei tre tipi: gli assegna il ruolo corrispondente, gli toglie l'eventuale ruolo di rimozione configurato, e posta un report nel canale impostato. Se l'utente aveva già un report precedente, quello vecchio viene sostituito dal nuovo. **Nota:** `/verify sub` non ha più il campo "social" (rimosso su richiesta); `/verify domme` e `/verify maledom` lo mantengono.
- **`/verify edit`** — Modifica i dati (verifica/social) dell'ultimo report di un utente.

## 🪧 Giorni dall'ultimo incidente (`/incident`)

Riservato agli admin. Mantiene aggiornato in un canale il cartello "Days since last incident" con il numero corrente.

- **`/incident channel`** — Imposta il canale dove tenere aggiornato il cartello.
- **`/incident setnumber`** — Imposta manualmente il contatore a un numero specifico.
- **`/incident reset`** — Azzera il contatore (da usare quando è appena successo un incidente).

Ogni giorno a mezzanotte il contatore aumenta automaticamente di 1 e il cartello viene rigenerato. Viene sempre mantenuto un solo messaggio visibile: quando il cartello si aggiorna, quello vecchio viene cancellato.

## 🚀 Ruoli personalizzati booster (`/customrole`)

Riservato agli admin. Collega un ruolo personalizzato (che assegni manualmente a un booster) al relativo utente, così che venga rimosso automaticamente se smette di boostare il server.

- **`/customrole link`** — Collega un ruolo personalizzato a un booster.
- **`/customrole unlink`** — Smette di tenere traccia del collegamento (non rimuove il ruolo dall'utente). Il ruolo è opzionale: se omesso, scollega tutti i ruoli associati a quell'utente in una volta sola.
- **`/customrole list`** — Elenca i collegamenti attivi, opzionalmente filtrati per utente.
- **`/customrole toggle`** — Abilita/disabilita con un solo comando la rimozione automatica per l'intero server. I collegamenti restano salvati anche da disabilitata.

Quando un utente perde il ruolo Booster di Discord (scadenza del boost, rimozione manuale, ecc.), tutti i ruoli personalizzati collegati a lui vengono rimossi automaticamente. Gli utenti con il ruolo `1090658915810820156` sono sempre esclusi da questa rimozione automatica, anche se hanno ruoli collegati e perdono il ruolo booster.
