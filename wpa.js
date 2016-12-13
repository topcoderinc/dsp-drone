let dbus = require('dbus-native');

process.env['DBUS_SESSION_BUS_ADDRESS'] = 'unix:path=/host/run/dbus/system_bus_socket';

function unmanageUnusedInterfaces() {
    return new Promise((resolve, reject) => {
        let unmanagedInterfaces = [];
        getWpaInterfacePaths()
        .then((interfacePaths) => {
            Promise.all(
                interfacePaths.map((interfacePath) => {
                    return new Promise((resolve, reject) => {
                        getWpaInterfaceState(interfacePath)
                        .then((result) => {
                            if (result == 'inactive') {
                                getWpaInterfaceNameFromPath(interfacePath)
                                .then((interfaceName) => {
                                    unmanageWpaInterface(interfacePath)
                                    .then((result) => {
                                        unmanagedInterfaces.push(interfaceName);
                                        resolve();
                                    });
                                });
                            } else {
                                resolve();
                            }
                        })
                    })
                })
            )
            .then(() => {
                resolve(unmanagedInterfaces);
            });
        });
    });
}


function getWpaInterfacePaths() {
    let sessionBus = dbus.sessionBus();
    return new Promise((resolve, reject) => {
        sessionBus.invoke({
            path: "/fi/w1/wpa_supplicant1",
            interface: "org.freedesktop.DBus.Properties",
            member: "Get",
            destination: "fi.w1.wpa_supplicant1",
            signature: "ss",
            body: [
                "fi.w1.wpa_supplicant1",
                "Interfaces"
            ]
        }, function (err, result) {
            sessionBus.connection.end();
            if (err) {
                reject(err);
            } else {
                resolve(result[1][0]);
            }
        });
    });
}

function getWpaInterfaceNameFromPath(path) {
    let sessionBus = dbus.sessionBus();
    return new Promise((resolve, reject) => {
        sessionBus.invoke({
            path: path,
            interface: "org.freedesktop.DBus.Properties",
            member: "Get",
            destination: "fi.w1.wpa_supplicant1",
            signature: "ss",
            body: [
                "fi.w1.wpa_supplicant1.Interface",
                "Ifname"
            ]
        }, function (err, result) {
            sessionBus.connection.end();
            if (err) {
                reject(err);
            } else {
                resolve(result[1][0]);
            }
        });
    });
}

function getWpaInterfaceState(path) {
    let sessionBus = dbus.sessionBus();
    return new Promise((resolve, reject) => {
        sessionBus.invoke({
            path: path,
            interface: "org.freedesktop.DBus.Properties",
            member: "Get",
            destination: "fi.w1.wpa_supplicant1",
            signature: "ss",
            body: [
                "fi.w1.wpa_supplicant1.Interface",
                "State"
            ]
        }, function (err, result) {
            sessionBus.connection.end();
            if (err) {
                reject(err);
            } else {
                resolve(result[1][0]);
            }
        });
    });
}

function unmanageWpaInterface(path) {
    let sessionBus = dbus.sessionBus();
    return new Promise((resolve, reject) => {
        sessionBus.invoke({
            path: "/fi/w1/wpa_supplicant1",
            interface: "fi.w1.wpa_supplicant1",
            member: "RemoveInterface",
            destination: "fi.w1.wpa_supplicant1",
            signature: "o",
            body: [
                path
            ]
        }, function (err, result) {
            sessionBus.connection.end();
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

module.exports = {
    unmanageUnusedInterfaces: unmanageUnusedInterfaces
};