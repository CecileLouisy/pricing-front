# Pricing Front

Front-end vanilla (HTML/CSS/JS) pour le service **Pricing** du projet fil rouge de gestion de parking.

Quatre vues :

1. **Grille** — affiche les tarifs actifs par zone × mode + la gratuité initiale.
2. **Simulateur** — calcule un prix pour une zone, un mode et une durée, avec détail du calcul.
3. **Administration** — modifie les tarifs et la gratuité, consulte l'historique des grilles et retrouve un ancien devis. Visible uniquement après connexion admin (🔒).
4. **Documentation** — liens vers Swagger UI, ReDoc et OpenAPI JSON.

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
- **Design bleu ardoise** — palette `#3d5a80` (light) / `#8ab0d4` (dark), typographie **Bebas Neue** (titres) + **DM Sans** (corps) + **JetBrains Mono** (chiffres). Contrastes AA+ garantis.
- **Thème clair par défaut**, toggle clair/sombre disponible.
- **Responsive mobile** — mise en page adaptée aux écrans ≤ 640 px : header compact, cartes empilées, toasts pleine largeur, formulaires en colonne.
- **Ticket UI** — le résultat du simulateur s'affiche comme un vrai ticket de stationnement, coins découpés compris.
- **Health check** en continu (toutes les 30 s) avec indicateur visuel.
- **États de chargement / erreur** — spinners animés pendant les appels API, messages d'erreur avec bouton « Réessayer » sur la grille et l'historique.
- **Toasts** pour les erreurs et succès (auto-disparition).
- **Jeton admin persisté dans `localStorage`** — reste privé au navigateur.

## Accessibilité

- **Skip-to-content** — lien d'accès rapide au contenu principal, visible au premier Tab.
- **Navigation clavier** — flèches gauche/droite pour parcourir les onglets (Home / End pour premier / dernier), roving `tabindex`.
- **Focus management** — le focus est placé sur le titre de la vue au changement d'onglet ; retour du focus sur le bouton 🔒 à la fermeture du dialog.
- **ARIA** — `aria-describedby` sur les champs avec indications, `aria-labelledby` sur le dialog et les groupes radio, `role="alert"` sur les messages d'erreur, `role="group"` sur les champs de durée.

## Sécurité

- L'onglet Administration est **masqué par défaut**. Il n'apparaît qu'après saisie d'un jeton via le bouton 🔒.
- Si un appel admin retourne 401, le jeton est automatiquement effacé et l'onglet admin est masqué.
- Le jeton n'est jamais envoyé au serveur GitHub Pages : il est stocké dans `localStorage` et envoyé uniquement à l'API Render dans le header `X-Admin-Token`.
- L'API Pricing est configurée avec `CORS_ORIGINS` restreint au domaine GitHub Pages.
- Aucune donnée sensible n'est manipulée (pas de plaque, pas de nom, pas de paiement).

## Structure

```
pricing-front/
├── index.html      Structure des 4 vues + header/footer + dialog admin
├── style.css       Palette, typographie, mise en page
├── app.js          Router de tabs, client API, formulaires, toasts
├── .gitignore
└── README.md
```
