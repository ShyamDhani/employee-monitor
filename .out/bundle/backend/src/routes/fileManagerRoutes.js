const express = require('express');
const router = express.Router();
const controller = require('../controllers/fileManagerController');

router.post('/list', controller.saveDirectoryListing);
router.post('/file', controller.saveFileContent);
router.post('/search', controller.saveSearchResults);
router.post('/apps', controller.saveInstalledApps);
router.get('/browse/:employee_id', controller.browseEmployee);
router.get('/file/:employee_id/*', controller.getFile);
router.get('/listings/:employee_id', controller.getListings);
router.get('/files/:employee_id', controller.getFiles);
router.get('/apps/:employee_id', controller.getInstalledApps);

module.exports = router;
