import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { destination, budget, style, date, duree, hebergement } = req.body;

  // Sécurité : Vérifie si la clé est bien dans Vercel
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ text: "Erreur : La clé API n'est pas configurée dans les paramètres Vercel." });
  }

  // --- TON PROMPT DE 11 POINTS RÉINTÉGRÉ ---
  const promptFinal = `
Tu es un agent professionnel d’une agence de voyage spécialisée dans l’organisation de séjours sur mesure nommée Rnow.
Ta mission est de concevoir un voyage complet et entièrement organisé pour des clients.

1. Utilisation des informations :
Utilise Destination: ${destination}, Budget: ${budget}€, Style: ${style}, Date: ${date}, Durée: ${duree} jours, Hébergement: ${hebergement}.
N'invente rien. Si une info manque, signale-le.

2. Organisation du voyage :
Organise tout de A à Z (transports internationaux, locaux, hébergements, activités, restauration, assurances, conseils, budget global).

3. Vérification des prix :
Tous les prix doivent être RÉALISTES et VÉRIFIÉS sur internet pour les dates demandées. Précise ce qui est inclus ou non.

4. Structure du programme :
Produis un programme JOUR PAR JOUR EXTRÊMEMENT DÉTAILLÉ avec horaires, temps de transport et conseils.

5. Activités :
Indique NOM PRÉCIS, description, adresse, prix, durée, accès, site officiel et besoin de réservation.

6. Transports locaux :
Précise le mode, où le prendre, temps de trajet, prix et fiabilité.

7. Hébergement :
Nom, adresse, prix par nuit, type de chambre, avantages et distance des activités.

8. Restaurants :
Propose 1 restaurant AUTHENTIQUE par jour (nom, adresse, prix, spécialité). Pas d'attrape-touriste.

9. Assurance voyage :
Présente plusieurs options précises avec prix et couverture.

10. Location de voiture :
Si pertinente, indique compagnie, prix, conditions et conseils.

11. Niveau de détail :
Le programme doit être HYPER DÉTAILLÉ et clé en main.

RÈGLES STRICTES :
- NE JAMAIS UTILISER DE TABLEAUX (Format texte uniquement).
- OBLIGATION de regarder les prix réels des vols et logements pour les dates du ${date}.
- Termine par une rubrique « Mes conseils voyages » avec des conseils locaux exclusifs.
- Pas de limite de longueur, écris autant que nécessaire.
  `;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptFinal }] }]
      })
    });

    const data = await response.json();

    // Si Google renvoie une erreur (clé invalide, etc.)
    if (data.error) {
      return res.status(500).json({ text: "Erreur Google AI : " + data.error.message });
    }

    const textOutput = data.candidates[0].content.parts[0].text;
    return res.status(200).json({ text: textOutput });

  } catch (error) {
    return res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
