# Amendment — Question Visuals & Mortal Kombat Bracket Control

Date: 2026-08-18
Status: Approved requirement

This amendment extends the approved Wedding Celebration Hub design.

## 1. Small humorous images for questions

Every quiz/voting question may have an optional small thematic image or meme-style illustration shown with the question.

Goals:
- make each question feel more alive and memorable;
- create a visual punchline without turning the interface into a meme dump;
- help guests understand the tone of the question instantly;
- keep the text as the primary content.

Presentation:
- small image/card above or beside the question on mobile;
- larger but still secondary image on projector;
- consistent crop/aspect ratio so layouts do not jump between questions;
- dark premium framing to match the site;
- no busy captions burned into the image unless intentionally designed;
- images can be funny, exaggerated, editorial, or lightly absurd depending on the question.

Examples:
- `Кто дольше собирается?` — exaggerated getting-ready scene / clock / person buried in clothes;
- `Кто первым мирится?` — two people back-to-back with one secretly offering peace/coffee;
- `Кто транжира?` — absurd shopping bags / card terminal / empty wallet;
- `Кто заведёт ещё животное?` — couple surrounded by an unreasonable number of pets;
- `Кто главный?` — comic throne/crown visual without using cheesy wedding graphics.

Data model addition for `questions`:
- `image_path` or `image_url` nullable;
- `image_alt` nullable;
- optional `image_focus` / crop metadata if needed later.

Admin requirements:
- owner/admin can upload, replace, remove, preview and reorder question media;
- the question remains valid without an image;
- image loading failure must never block voting;
- media should be stored in Supabase Storage or another deploy-safe store, not as large binary files in GitHub.

The first implementation can use prepared static images. Future versions may add AI-assisted image generation, but automatic generation is not required for MVP.

## 2. Mortal Kombat tournament — registered guests as players

Tournament participants are drawn from guests registered for the Mortal Kombat module.

Registration flow:
- guests join the event normally;
- when Mortal Kombat registration is open, a guest can claim one tournament slot;
- maximum 16 active tournament registrations;
- admin can add/remove/rename a participant manually if needed;
- admin can close or reopen registration before tournament start;
- admin can replace a no-show with another registered guest before or during the tournament when operationally necessary.

Each tournament player should retain a link to the corresponding guest where possible:
- `guest_id`
- display name / nickname snapshot
- seed / bracket position
- tournament status

## 3. Owner-controlled editable bracket

The owner/admin has full correction authority over the Mortal Kombat bracket.

Admin can:
- randomize initial bracket;
- manually reorder all 16 registered players before start;
- swap two players in the Round-of-16 bracket;
- replace a participant;
- edit player display names;
- mark which match is currently being played;
- select the winner of each completed match;
- automatically advance that winner to the correct next-round slot;
- undo a winner selection;
- correct a previous result and safely recompute affected downstream slots;
- manually repair a downstream matchup if something became inconsistent;
- reset one match, one round, or the entire tournament with confirmation.

The owner is the only role allowed to mutate the bracket or record winners.

Guests and players can only view tournament state; they cannot advance themselves or edit results.

## 4. Tournament progression

For 16 players:
- Round of 16: 8 matches;
- Quarterfinals: 4 matches;
- Semifinals: 2 matches;
- Final: 1 match;
- winner becomes `champion`.

Normal flow:
1. Admin marks Match A as `Сейчас играют`.
2. The match is played on the console.
3. Admin taps the registered guest who won.
4. Site marks the loser eliminated.
5. Winner advances automatically.
6. Projector and guest pages update in realtime.
7. Repeat until final champion.

Champion reveal should be a distinct projector state, not just a small bracket update.

## 5. Bracket correction rules

Because live events are messy, correction must be a first-class feature, not an emergency hack.

If an earlier winner is changed after downstream matches have already been populated:
- the admin receives a clear warning showing which later slots/results are affected;
- system must not silently corrupt the bracket;
- affected future-but-unplayed slots can be recomputed automatically;
- if an affected downstream match is already completed, admin must explicitly confirm whether to clear/rebuild those later results;
- destructive corrections require confirmation.

Maintain an optional lightweight audit log of admin tournament actions for recovery/debugging during the event:
- timestamp;
- action type;
- affected match/player;
- previous value;
- new value.

This log is admin-only.

## 6. Projector treatment for Mortal Kombat

Projector states should include:
- registration count, e.g. `12 / 16 игроков`;
- bracket reveal after draw;
- current match spotlight with both guest names;
- round indicator;
- winner transition after admin records result;
- final matchup;
- champion reveal.

Do not rely on a single tiny full-bracket view for every stage. Use focused layouts when they are more readable on a 16:9 screen.

## 7. Security

Only the single owner/admin account defined in the owner-admin security amendment may:
- open/close registration;
- edit players;
- randomize/reorder bracket;
- mark current matches;
- set/undo/correct winners;
- reset tournament state.

RLS/server-side authorization must enforce this. Hiding controls in the UI is not sufficient.

## 8. Testing additions

Automated coverage should include:
- 17th guest cannot claim a slot when tournament is full;
- one guest cannot occupy multiple active slots;
- owner can swap initial bracket players;
- non-owner cannot mutate bracket;
- selecting a winner advances the correct registered guest;
- loser becomes eliminated;
- undo restores prior state;
- correcting an earlier result identifies affected downstream matches;
- resetting a match does not corrupt unrelated bracket branches;
- champion is produced only after a valid final result;
- question image failure does not block question text or voting.
