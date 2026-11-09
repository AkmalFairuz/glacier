import { useMicTest } from '../hooks/useMicTest'
import { InputModeSection } from './InputModeSection'
import { InputProfileSection } from './InputProfileSection'
import { VoiceDevicesSection } from './VoiceDevicesSection'

export function VoicePage() {
  useMicTest()
  return (
    <>
      <VoiceDevicesSection />
      <InputProfileSection />
      <InputModeSection />
    </>
  )
}
