# Travel Budget Manager

**Plan your trip budget, then track every expense against it.**

Travel Budget Manager is a lightweight web app for building a trip budget *before* you book and keeping it honest while you travel — every leg, every category, one running total, in 150+ currencies with live exchange rates. An optional AI budget starter (Google Gemini) suggests trip ideas and starting budgets. It works in **English, French, Spanish, and Vietnamese**.

By **TranZen** · Net proceeds from the paid editions support charitable causes · [tranzenstudio.com](https://tranzenstudio.com)

---

## What it does

- **Budget before you book** — price the whole trip (flights, stays, transport, food, entertainment), see the total, and adjust until it fits.
- **Three-level tracking** — Budget → Committed → Actual Paid, so you stay in control at every stage.
- **Every cost in one place** — multi-city or multi-leg trips, every category, one running total, with live currency conversion.
- **AI budget starter (optional)** — answer a few questions and get trip ideas with starting budgets you can adjust, via Google Gemini.
- **Four languages** — English · Français · Español · Tiếng Việt.

## Get it

- **Free download (this repository).** Click **Code → Download ZIP**, or clone the repo. Free to use for any noncommercial purpose (see the license below).
- **On the app stores** *(coming soon)* — Google Play and Amazon, for one-tap install and updates. The store editions are what fund the charitable giving.

## Run it

It's a Progressive Web App — no install or account required. Because it loads a few libraries and live currency rates from the internet, it's best **served** rather than opened straight off disk:

- **Locally:** from the `docs/` folder, run a tiny static server — e.g. `python3 -m http.server` — then open the address it prints. (You can also open `docs/index.html` directly; the app will run, but the installable/offline PWA features need it served.)
- **Hosted:** the app lives in `docs/`, ready for **GitHub Pages** — *Settings → Pages → Deploy from a branch → main → /docs*. Your live address appears there a minute later.

**Your data stays with you.** Trips, budgets, and expenses are stored in your browser's local storage on your own device — nothing is sent to a server. (An optional `server.js` backend can mirror the data to disk for a desktop deployment, but it isn't required and isn't included here — without it, the app runs happily on local storage.)

## Proceeds & transparency

Net proceeds from the paid editions, after costs, are donated to a registered charity. The free download here is offered as a gift. TranZen publishes regular reports of **proceeds, costs, and donations** at [tranzenstudio.com](https://tranzenstudio.com).

## License

Free to use and learn from — **not for resale.** Licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). You may use, copy, modify, and share it for any **noncommercial** purpose; selling it, or a product built from it, is not permitted. As the copyright holder, TranZen keeps full commercial rights (including the app-store editions), so this protects the cause without restricting the maker.

## Questions

For the app, partnerships, or anything else → **[tranzenstudio.com](https://tranzenstudio.com)**.

## Credits

Created by **TranZen**, with the assistance of AI tools.
