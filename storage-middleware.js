const fs = require('node:fs').promises;
const path = require('node:path');
const express = require('express');

function configFileMiddleware({storageDir = '' , endpointPrefix = '/config'} = {}) {
    const router = express.Router();

    // Resolve and ensure storage directory
    const resolvedDir = storageDir && storageDir.trim()
        ? path.resolve(storageDir)
        : path.resolve(__dirname , 'storage');

    fs.mkdir(resolvedDir , {recursive : true}).catch(console.error);

    // Helper to get full file path, ensures .json extension
    const getFilePath = (filename) => {
        if ( ! /^[\w\-\.]+$/.test(filename) ) {
            throw new Error('Invalid filename');
        }
        return path.join(resolvedDir , `${filename}.json`);
    };

    // READ: GET /config/:filename
    router.get(`${endpointPrefix}/:filename` , async (req , res) => {
        try {
            const filePath = getFilePath(req.params.filename);
            const content = await fs.readFile(filePath , 'utf8');
            res.type('application/json').send(content);
        } catch (err) {
            res.status(404).json({success : false , error : 'File not found'});
        }
    });

    // WRITE: POST or PUT /config/:filename
    router.post(`${endpointPrefix}/:filename` , handleWrite);
    router.put(`${endpointPrefix}/:filename` , handleWrite);

    async function handleWrite(req , res) {
        try {
            const filePath = getFilePath(req.params.filename);
            const contentType = req.get('content-type') ?? '';

            let data;
            if ( contentType.includes('application/json') ) {
                data = typeof req.body === 'string'
                    ? JSON.stringify(req.body , null , 2)
                    : typeof req.body === 'object'
                        ? req.body
                        : JSON.stringify(`${req.body}` , null , 2);
            } else {
                // Otherwise treat as plain text or other format, convert to string
                data = typeof req.body === 'string' ? req.body : String(req.body);
            }

            await fs.promises.writeFile(filePath , data , 'utf8');
            res.json({success : true});
        } catch (err) {
            res.status(500).json({success : false , error : err.message});
        }
    }

    // APPEND: PATCH /config/:filename
    router.patch(`${endpointPrefix}/:filename` , async (req , res) => {
        try {
            const filePath = getFilePath(req.params.filename);

            let existing = '{}';
            try {
                existing = await fs.readFile(filePath , 'utf8');
            } catch (e) {
                // File doesn't exist yet, treat as empty JSON
            }

            const existingJson = JSON.parse(existing);
            const incoming = typeof req.body === 'object' ? req.body : JSON.parse(req.body);

            if ( typeof existingJson !== 'object' || Array.isArray(existingJson) ) {
                throw new Error('Existing file is not a JSON object');
            }
            if ( typeof incoming !== 'object' || Array.isArray(incoming) ) {
                throw new Error('Appended data must be a JSON object');
            }

            const merged = {...existingJson , ...incoming};
            await fs.writeFile(filePath , JSON.stringify(merged , null , 2) , 'utf8');

            res.json({success : true});
        } catch (err) {
            res.status(500).json({success : false , error : err.message});
        }
    });

    return router;
}

module.exports = configFileMiddleware;
