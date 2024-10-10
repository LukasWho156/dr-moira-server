import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import pgPromise from "pg-promise";
import { Level } from "../model/level.js";
import { LEVELS } from "../levels/levels.js";
const app = express();
const port = process.env.PORT || 3000;
const pgConString = process.env.PG_CON_STRING || 'postgres://postgres:postgres@localhost:5432';
const pgp = pgPromise();
const connection = pgp(pgConString);
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.post('/api/submitSolution', (req, res) => {
    const levelDef = LEVELS[req.body.level];
    if (!req.body.player) {
        res.status(400).send('missing player information');
        return;
    }
    if (!levelDef) {
        res.status(400).send('level does not exist');
        return;
    }
    const level = new Level(levelDef);
    const solution = req.body.solution;
    if (!Array.isArray(solution)) {
        res.status(400).send('malformed solution');
        return;
    }
    for (const step of solution) {
        level.processInput(step, true);
    }
    if (!level.won) {
        res.status(400).send('invalid solution');
        return;
    }
    const insertObj = {
        level: req.body.level,
        version: levelDef.version,
        player: req.body.player,
        steps: JSON.stringify(solution),
        stepcount: solution.length,
    };
    connection.none("INSERT INTO solutions(level, version, player, steps, stepcount) VALUES (${level}, ${version}, ${player}, ${steps}, ${stepcount})", insertObj).then(() => {
        res.send('solution accepted!');
    }).catch((e) => {
        console.log('Error: ', e);
        res.status(501).send('database error');
    });
});
app.get('/api/getLevelSolutions/:levelId', (req, res) => {
    console.log(req.params);
    const levelDef = LEVELS[req.params.levelId];
    if (!levelDef) {
        res.status(404).send('level does not exist');
        return;
    }
    const selectObj = {
        level: req.params.levelId,
        version: levelDef.version,
    };
    connection.any("SELECT player, steps, stepcount FROM solutions WHERE level=${level} AND version=${version}", selectObj).then((solutions) => {
        res.json(solutions);
    }).catch((e) => {
        console.log('Error: ', e);
        res.status(501).send('database error');
    });
});
app.listen(port, () => {
    console.log('listening on port ' + port);
});
