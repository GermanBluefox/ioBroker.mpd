"use strict";

var utils = require(__dirname + '/lib/utils');
var adapter = utils.adapter('mpd');

var mpd = require('mpd'),
    cmd = mpd.cmd;

var client, timer, int;
var isPlay = false;
adapter.on('unload', function (callback) {
    try {
        adapter.log.info('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

adapter.on('objectChange', function (id, obj) {
    adapter.log.debug('objectChange ' + id + ' ' + JSON.stringify(obj));
});

adapter.on('stateChange', function (id, state) {
    adapter.getState('info.connection', function (err, st) {
        if (st || !err){
            if (state && !state.ack) {
                adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));
                
                var val = [state.val];
                if (val === false || val === 'false'){
                    val = 0;
                } else if (val === true || val === 'true'){
                    val = 1;
                }
                var ids = id.split(".");
                var command = ids[ids.length - 1].toString();
                if (command === 'volume'){
                    command = 'setvol';
                }
                if (command === 'next' || command === 'previous'){
                    val = [];
                }
                client.sendCommand(cmd(command, val), function(err, msg) {
                    if (err) throw err;
                    adapter.log.info('client.sendCommand - ' + JSON.stringify(msg));
                    GetStatus(["status", "currentsong", "stats"]);
                });
            }
        }
    });
});

adapter.on('ready', function () {
    main();
});

function main() {
    var status = [];
    isPlay = false;
    client = mpd.connect({
        host: adapter.config.ip || '192.168.1.10',
        port: adapter.config.port || 6600
    });
    client.on('ready', function() {
        adapter.log.info("ready");
        adapter.setState('info.connection', true, true);
        GetStatus(["status"]);
    });

    client.on('system', function(name) {
        adapter.log.info("update- " + JSON.stringify(name));
        status = ["status", "currentsong", "stats"];
        GetStatus(status);
    });

    client.on('error', function(err) {
        adapter.log.error("MPD Error"+ err);
    });

    client.on('end', function(name) {
        clearTimeout(timer);
        adapter.log.info("connection closed", name);
        adapter.setState('info.connection', false, true);
        timer = setTimeout(function (){
            main();
        }, 5000);
    });

    adapter.subscribeStates('*');
}
function GetStatus(arr){
    if (arr){
        arr.forEach(function(status){
            client.sendCommand(cmd(status, []), function (err, res){
                if (err) throw err;
                var obj = mpd.parseKeyValueMessage(res);
                adapter.log.debug('GetStatus - ' + JSON.stringify(obj));
                for (var key in obj) {
                    if (obj.hasOwnProperty(key)){
                        SetObj(key, obj[key]);
                    }
                }
            });
        });
    }
}

function SetObj(state, val){
    adapter.getState(state, function (err, st){
        if ((err || !st) && state){
            adapter.log.info('Create new state - ' + state);
            adapter.setObject(state, {
                type:   'state',
                common: {
                    name: state,
                    type: 'state',
                    role: 'media'
                },
                native: {}
            });
            if (state === 'state' && val === 'play'){
                isPlay = true;
            }
            adapter.setState(state, {val: val, ack: true});
        } else {
            if (state === 'state' && val === 'play'){
                isPlay = true;
            }
            if (st.val !== val){
                adapter.setState(state, {val: val, ack: true});
            }
        }
        GetTime();
    });
}
function GetTime(){
    clearTimeout(int);
    if (isPlay){
        int = setTimeout(function (){
            isPlay = false;
            GetStatus(["status"]);
        }, 1000);
    }
}