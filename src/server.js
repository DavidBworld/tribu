require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

const fs = require('fs').promises;
const dbPath = path.join(__dirname, '../database.json');

app.get('/api/data', async (req, res) => {
    try {
        const data = await fs.readFile(dbPath, 'utf8');
        res.json(JSON.parse(data));
    } catch (e) {
        console.error("Erreur de lecture bd:", e);
        res.status(500).json({ error: "Erreur lecture base de données" });
    }
});

app.post('/api/data', async (req, res) => {
    try {
        console.log('Data received by server:', req.body);
        await fs.writeFile(dbPath, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (e) {
        console.error("Erreur d'écriture bd:", e);
        res.status(500).json({ error: "Erreur écriture base de données" });
    }
});

// Initialisation du Cerveau Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Endpoint de l'API Antigravity
app.post('/api/gemini', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: "Prompt manquant" });

        console.log("🧠 Requête reçue :", prompt);
        
        // Utilisation du modèle rapide et performant
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        
        res.json({ reply: response.text() });
    } catch (error) {
        console.error("❌ Erreur Gemini:", error);
        res.status(500).json({ error: "Erreur de connexion au Cerveau." });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Serveur actif sur http://localhost:${PORT}`);
    console.log(`🧠 Connexion au Cerveau Gemini : EN ATTENTE DE REQUÊTES...`);
});
