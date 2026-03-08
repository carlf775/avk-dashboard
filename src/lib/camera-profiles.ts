export interface SettingDef {
  key: string;
  label: string;
  hint?: string;
  widget?: 'slider' | 'channel-sliders';
  selectorKey?: string;  // for channel-sliders: the enum key that selects the channel
  min?: number;
  max?: number;
}

interface SettingsSection {
  label: string;
  settings: SettingDef[];
}

export interface CameraProfile {
  sections: SettingsSection[];
}

const beckhoffVUI2001: CameraProfile = {
  sections: [
    {
      label: 'Exposure',
      settings: [
        { key: 'ExposureTime', label: 'Exposure Time', hint: 'Sensor exposure duration in µs' },
        { key: 'ExposureMode', label: 'Exposure Mode' },
      ],
    },
    {
      label: 'Gain & Levels',
      settings: [
        { key: 'Gain', label: 'Gain', hint: 'Analog gain in dB' },
        { key: 'GainSelector', label: 'Gain Selector' },
        { key: 'BlackLevel', label: 'Black Level' },
        { key: 'BlackLevelAuto', label: 'Black Level Auto' },
        { key: 'Gamma', label: 'Gamma' },
      ],
    },
    {
      label: 'Image Format',
      settings: [
        { key: 'Width', label: 'Width' },
        { key: 'Height', label: 'Height' },
        { key: 'OffsetX', label: 'Offset X' },
        { key: 'OffsetY', label: 'Offset Y' },
        { key: 'PixelFormat', label: 'Pixel Format' },
        { key: 'ReverseX', label: 'Reverse X' },
        { key: 'ReverseY', label: 'Reverse Y' },
      ],
    },
    {
      label: 'Trigger',
      settings: [
        { key: 'TriggerMode', label: 'Trigger Mode' },
        { key: 'TriggerSource', label: 'Trigger Source' },
        { key: 'TriggerActivation', label: 'Trigger Activation' },
        { key: 'TriggerDelay', label: 'Trigger Delay', hint: 'Delay after trigger in µs' },
      ],
    },
    {
      label: 'Acquisition',
      settings: [
        { key: 'AcquisitionMode', label: 'Acquisition Mode' },
        { key: 'AcquisitionFrameRate', label: 'Frame Rate' },
        { key: 'AcquisitionFrameRateEnable', label: 'Frame Rate Enable' },
      ],
    },
    {
      label: 'White Balance',
      settings: [
        { key: 'BalanceRatioSelector', label: 'Balance Ratio Selector' },
        { key: 'BalanceRatio', label: 'Balance Ratio' },
      ],
    },
    {
      label: 'Optics',
      settings: [
        { key: 'FocalPower', label: 'Focal Power' },
        { key: 'ObjectCameraDistance', label: 'Object Distance' },
        { key: 'OpticControllerStatus', label: 'Controller Status' },
        { key: 'OpticControllerTemperature', label: 'Controller Temperature' },
      ],
    },
    {
      label: 'Lighting',
      settings: [
        { key: 'LightControllerEnabled', label: 'Lighting Enabled' },
        { key: 'LightController0ChannelBrightness', label: 'Channel Brightness', widget: 'channel-sliders', selectorKey: 'LightController0ChannelSelector', min: 0, max: 255 },
        { key: 'LightController0ChannelTriggerMode', label: 'Channel Trigger Mode' },
      ],
    },
    {
      label: 'Network',
      settings: [
        { key: 'GevSCPSPacketSize', label: 'Packet Size', hint: 'GigE Vision stream packet size' },
      ],
    },
  ],
};

const genericProfile: CameraProfile = {
  sections: [
    {
      label: 'Exposure',
      settings: [
        { key: 'ExposureTime', label: 'Exposure Time' },
        { key: 'ExposureMode', label: 'Exposure Mode' },
        { key: 'ExposureAuto', label: 'Auto Exposure' },
      ],
    },
    {
      label: 'Gain',
      settings: [
        { key: 'Gain', label: 'Gain' },
        { key: 'GainAuto', label: 'Auto Gain' },
        { key: 'GainSelector', label: 'Gain Selector' },
        { key: 'BlackLevel', label: 'Black Level' },
        { key: 'Gamma', label: 'Gamma' },
      ],
    },
    {
      label: 'Image Format',
      settings: [
        { key: 'Width', label: 'Width' },
        { key: 'Height', label: 'Height' },
        { key: 'OffsetX', label: 'Offset X' },
        { key: 'OffsetY', label: 'Offset Y' },
        { key: 'PixelFormat', label: 'Pixel Format' },
      ],
    },
    {
      label: 'Trigger',
      settings: [
        { key: 'TriggerMode', label: 'Trigger Mode' },
        { key: 'TriggerSource', label: 'Trigger Source' },
        { key: 'TriggerActivation', label: 'Trigger Activation' },
      ],
    },
    {
      label: 'Acquisition',
      settings: [
        { key: 'AcquisitionMode', label: 'Acquisition Mode' },
        { key: 'AcquisitionFrameRate', label: 'Frame Rate' },
      ],
    },
    {
      label: 'Lighting',
      settings: [
        { key: 'LightControllerEnabled', label: 'Lighting Enabled' },
        { key: 'LightController0ChannelBrightness', label: 'Channel Brightness', widget: 'channel-sliders', selectorKey: 'LightController0ChannelSelector', min: 0, max: 255 },
        { key: 'LightController0ChannelTriggerMode', label: 'Channel Trigger Mode' },
      ],
    },
  ],
};

interface ProfileEntry {
  vendor: string;
  model: string;
  profile: CameraProfile;
}

const profiles: ProfileEntry[] = [
  { vendor: 'beckhoff', model: 'vui', profile: beckhoffVUI2001 },
];

export function getProfile(vendor?: string, model?: string): CameraProfile | null {
  if (vendor && model) {
    const v = vendor.toLowerCase();
    const m = model.toLowerCase();
    for (const entry of profiles) {
      if (v.includes(entry.vendor) && m.includes(entry.model)) return entry.profile;
    }
  }
  return genericProfile;
}
