# Pricing Front

Front-end vanilla (HTML/CSS/JS) pour le service **Pricing** du projet fil rouge de gestion de parking.

Trois vues :

1. **Grille** — affiche les tarifs actifs par zone × mode + la gratuité initiale (user story "panneau d'affichage").
2. **Simulateur** — calcule un prix pour une zone, un mode et une durée, avec détail du calcul.
3. **Administration** — modifie les tarifs et la gratuité (protégé par jeton `X-Admin-Token`), consulte l'historique des grilles et retrouve un ancien devis.

## API cible

Configurée dans `app.js` :

```js
const API_URL = "https://pricing-9khk.onrender.com";
```

## Développement local

Aucun build, aucune dépendance. Ouvre simplement `index.html` dans un navigateur, ou sers le dossier :

```bash
# Python
python -m http.server 5500

# Node
npx serve .
```

Puis http://localhost:5500.

## Déploiement sur GitHub Pages

1. Créer un nouveau repo GitHub `pricing-front`.
2. Pousser ce dossier :
   ```bash
   git init
   git add .
   git commit -m "Initial front"
   git branch -M main
   git remote add origin https://github.com/<user>/pricing-front.git
   git push -u origin main
   ```
3. Sur GitHub : **Settings → Pages → Source = Deploy from a branch → main / root**.
4. Attendre 30-60 s, l'URL publique s'affichera dans l'onglet Pages.

## Stack et parti pris

- **HTML/CSS/JS vanilla** — zéro dépendance, zéro build, zéro `node_modules`.
- **Design "signalétique parking"** — palette jaune signalétique (`#F5C518`) + noir asphalte + bleu signalisation, typographie **Bebas Neue** (grand format panneau) + **DM Sans** (corps) + **JetBrains Mono** (chiffres).
- **Thème sombre par défaut** (choix éditorial cohérent avec l'affichage borne / panneau), toggle clair/sombre disponible, respecte `prefers-color-scheme`.
- **Ticket UI** — le résultat du simulateur s'affiche comme un vrai ticket de stationnement, coins découpés compris.
- **Health check** en continu (toutes les 30 s) avec indicateur visuel.
- **Toasts** pour les erreurs et succès (auto-disparition).
- **Jeton admin persisté dans `localStorage`** — reste privé au navigateur.

## Sécurité

- Le jeton admin n'est jamais envoyé au serveur des tuiles GitHub Pages : il est stocké dans `localStorage` et envoyé uniquement à l'API Render sur les écritures.
- L'API Pricing exige CORS-safe origins ; le repo Render est configuré avec `CORS_ORIGINS=*` pour l'exercice.
- Aucune donnée sensible n'est manipulée (pas de plaque, pas de nom, pas de paiement).

## Structure

```
pricing-front/
├── index.html      Structure des 3 vues + header/footer
├── style.css       Palette, typographie, mise en page
├── app.js          Router de tabs, client API, formulaires, toasts
├── .gitignore
└── README.md
```
