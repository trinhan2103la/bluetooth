import { useState } from 'react';

const BluetoothConnection = () => {
  const [deviceList, setDeviceList] = useState([]);
  const [connectedDevice, setConnectedDevice] = useState(null);

  const addDevice = (device) => {
    const newDevice = {
      id: device.id,
      name: device.name || 'Unknown Device',
      device: device,
      connected: false,
      measurement: null,
      batteryLevel: null, // Add battery level
    };
    setDeviceList((prevList) => [...prevList, newDevice]);
  };

  // const handleOn = () => {
  //   navigator.bluetooth
  //     .requestDevice({
  //       filters: [
  //         { services: ['7eafd361-f150-4785-b307-47d34ed52c3c'] },
  //         { name: 'UWAVE' },
  //       ],
  //       optionalServices: [
  //         '00001800-0000-1000-8000-00805f9b34fb',
  //         '0000180F-0000-1000-8000-00805f9b34fb',
  //       ], // Add Battery Service
  //     })
  //     .then((device) => {
  //       if (!deviceList.some((d) => d.id === device.id)) {
  //         addDevice(device);
  //       }
  //     })
  //     .catch((error) => console.log('Error: ', error));
  // };

  const handleOn = () => {
    navigator.bluetooth
      .requestDevice({
        filters: [
          { services: ['7eafd361-f150-4785-b307-47d34ed52c3c'] }, // Sử dụng UUID đã được kiểm tra
          { name: 'UWAVE' },
        ],
        optionalServices: [
          '00001800-0000-1000-8000-00805f9b34fb',
          '0000180f-0000-1000-8000-00805f9b34fb', // Sửa thành chữ thường
        ],
      })
      .then((device) => {
        if (!deviceList.some((d) => d.id === device.id)) {
          addDevice(device);
        }
      })
      .catch((error) => console.log('Error: ', error));
  };

  const handleOff = () => {
    if (connectedDevice && connectedDevice.gatt.connected) {
      connectedDevice.gatt.disconnect();
      setConnectedDevice(null);
      setDeviceList(
        deviceList.map((device) => ({
          ...device,
          connected: false,
          measurement: null,
          batteryLevel: null, // Reset battery level
        }))
      );
    }
  };

  const updateDeviceStatus = (index, updates) => {
    setDeviceList((prevList) =>
      prevList.map((device, i) =>
        i === index ? { ...device, ...updates } : device
      )
    );
  };

  const connectToDevice = (device, index) => {
    updateDeviceStatus(index, { connecting: true });

    let deviceName = '';

    device.gatt
      .connect()
      .then((server) => {
        setConnectedDevice(device);
        return server.getPrimaryService('00001800-0000-1000-8000-00805f9b34fb');
      })
      .then((service) => {
        return service.getCharacteristic(
          '00002a00-0000-1000-8000-00805f9b34fb'
        );
      })
      .then((characteristic) => {
        return characteristic.readValue();
      })
      .then((value) => {
        let decoder = new TextDecoder('utf-8');
        deviceName = decoder.decode(value);
        console.log('Device Name: ', deviceName);

        updateDeviceStatus(index, {
          connected: true,
          connecting: false,
          name: deviceName || 'Unknown Device',
        });

        return device.gatt.getPrimaryService(
          '7eafd361-f150-4785-b307-47d34ed52c3c'
        );
      })
      .then((service) => {
        return service.getCharacteristic(
          '7eafd361-f151-4785-b307-47d34ed52c3c'
        );
      })
      .then((char) => {
        char.startNotifications().then(() => {
          char.addEventListener('characteristicvaluechanged', (event) =>
            handleCharacteristicValueChanged(event, index, deviceName)
          );
        });
        // Fetch battery level after connecting
        // return device.gatt.getPrimaryService(
        //   '0000180F-0000-1000-8000-00805f9b34fb'
        // );
        return device.gatt.getPrimaryService('battery_service');
      })
      .then((batteryService) => {
        // return batteryService.getCharacteristic(
        //   '00002a19-0000-1000-8000-00805f9b34fb'
        // );
        return batteryService.getCharacteristic('battery_level');
      })
      .then((batteryLevelCharacteristic) => {
        return batteryLevelCharacteristic.readValue();
      })
      .then((batteryLevel) => {
        const batteryPercentage = batteryLevel.getUint8(0);
        console.log('Battery Level: ', batteryPercentage + '%');
        updateDeviceStatus(index, { batteryLevel: batteryPercentage });
      })
      .catch((error) => {
        updateDeviceStatus(index, { connected: false, connecting: false });
        console.log('Connection failed: ', error);
      });
  };

  const disconnectFromDevice = (index) => {
    const deviceToDisconnect = deviceList[index].device;

    if (deviceToDisconnect.gatt.connected) {
      deviceToDisconnect.gatt.disconnect();
    }

    setDeviceList((prevList) => prevList.filter((_, i) => i !== index));

    if (connectedDevice && connectedDevice.id === deviceToDisconnect.id) {
      setConnectedDevice(null);
    }
  };

  const handleCharacteristicValueChanged = (event, index, deviceName) => {
    const value = event.target.value;
    const measurementValue = parseMeasurement(value, deviceName);
    updateDeviceStatus(index, { measurement: measurementValue });
  };

  const parseMeasurement = (value, deviceName) => {
    const byte4 = value.getUint8(3);
    const byte5 = value.getUint8(4);
    const byte6 = value.getUint8(5);
    let measurementValue = (byte6 << 16) | (byte5 << 8) | byte4;

    if (measurementValue & 0x800000) {
      measurementValue -= 0x1000000;
    }
    let finalValue = measurementValue / 100;

    if (deviceName.startsWith('07')) {
      finalValue /= 10;
      finalValue = parseFloat(finalValue.toFixed(3));
    }
    return finalValue;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">Bluetooth Connection</h1>
      <div>
        <button
          onClick={handleOn}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700"
        >
          On
        </button>
        <button
          onClick={handleOff}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-700 ml-4"
        >
          Off
        </button>
      </div>
      <table className="table-auto mt-6 w-4/5">
        <thead>
          <tr className="bg-gray-700 text-white">
            <th className="px-4 py-2 text-center">Device Name</th>
            <th className="px-4 py-2 text-center">Measurement</th>
            <th className="px-4 py-2 text-center">Battery Level</th>
            <th className="px-4 py-2 text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          {deviceList.map((device, index) => (
            <tr key={device.id}>
              <td className="border px-4 py-2 text-center">{device.name}</td>
              <td className="border px-4 py-2 text-center">
                {device.measurement !== null ? device.measurement : 'N/A'}
              </td>
              <td className="border px-4 py-2 text-center">
                {device.batteryLevel !== null
                  ? device.batteryLevel + '%'
                  : 'N/A'}
              </td>
              <td className="border px-4 py-2 text-center">
                {device.connected ? (
                  <>
                    <span>Connected ✔️</span>
                    <button
                      onClick={() => disconnectFromDevice(index)}
                      className="px-4 py-2 ml-2 bg-red-500 text-white rounded hover:bg-red-700"
                    >
                      Disconnect
                    </button>
                  </>
                ) : device.connecting ? (
                  <span>Connecting ⏳</span>
                ) : (
                  <button
                    onClick={() => connectToDevice(device.device, index)}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-700"
                  >
                    Connect
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BluetoothConnection;
