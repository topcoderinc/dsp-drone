#!/bin/bash                                                                                                                        
echo $goproWifiPassword|wpa_passphrase $goproWifiNetwork >wpa.conf
wpa_supplicant -c ./wpa.conf -i wlan1 -B
dhcpcd wlan1 &
