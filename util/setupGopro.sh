#!/bin/bash                                                                                                                        
INTERFACE=`cat /data/unmanagedwifi.txt`

echo $goproWifiPassword|wpa_passphrase $goproWifiNetwork >wpa.conf
wpa_supplicant -c ./wpa.conf -i $INTERFACE -B
dhcpcd $INTERFACE &
