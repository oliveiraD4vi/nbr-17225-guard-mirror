import React, { useState } from 'react'
import { Button, Divider, Select, Slider, Space, Tooltip } from 'antd'
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons'
import { t } from '@/i18n'
import type { VisionSimulationFilter } from '@/types'
import '../styles/vision-simulator.css'

interface VisionSimulatorProps {
  onFilterChange?: (filter: VisionSimulationFilter) => void
}

const filterOptions = [
  { label: t('vision.none'), value: 'none' },
  { label: t('vision.protanopia'), value: 'protanopia' },
  { label: t('vision.deuteranopia'), value: 'deuteranopia' },
  { label: t('vision.tritanopia'), value: 'tritanopia' },
  { label: t('vision.blur'), value: 'blur' },
]

export const VisionSimulator: React.FC<VisionSimulatorProps> = React.memo(({ onFilterChange }) => {
  const [filterType, setFilterType] = useState<VisionSimulationFilter['type']>('none')
  const [intensity, setIntensity] = useState(50)
  const [isActive, setIsActive] = useState(false)

  const handleFilterChange = (newType: VisionSimulationFilter['type']) => {
    setFilterType(newType)
    onFilterChange?.({
      type: newType,
      intensity,
    })
  }

  const handleIntensityChange = (value: number) => {
    setIntensity(value)
    onFilterChange?.({
      type: filterType,
      intensity: value,
    })
  }

  const toggleSimulation = () => {
    const newActive = !isActive
    setIsActive(newActive)

    onFilterChange?.({
      type: newActive ? filterType : 'none',
      intensity,
    })
  }

  return (
    <div className="vision-simulator">
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Tooltip title={t('vision.toggleTooltip')}>
          <Button
            type={isActive ? 'primary' : 'default'}
            icon={isActive ? <EyeOutlined /> : <EyeInvisibleOutlined />}
            onClick={toggleSimulation}
            block
          >
            {isActive ? t('vision.active') : t('vision.inactive')}
          </Button>
        </Tooltip>

        <Divider style={{ margin: '8px 0' }} />

        <div>
          <label>{t('vision.filterType')}:</label>
          <Select
            value={filterType}
            onChange={handleFilterChange}
            options={filterOptions}
            disabled={!isActive}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <label>{t('vision.intensity', { value: intensity })}</label>
          <Slider
            value={intensity}
            onChange={handleIntensityChange}
            disabled={!isActive || filterType === 'none'}
            min={0}
            max={100}
          />
        </div>

        <details className="simulator-info">
          <summary>{t('vision.infoSummary')}</summary>
          <div className="simulator-info-content">
            <p>{t('vision.infoDisclaimer')}</p>
            <p>
              <strong>Protanopia:</strong> {t('vision.infoProtanopia')}
            </p>
            <p>
              <strong>Deuteranopia:</strong> {t('vision.infoDeuteranopia')}
            </p>
            <p>
              <strong>Tritanopia:</strong> {t('vision.infoTritanopia')}
            </p>
            <p>
              <strong>Desfoque:</strong> {t('vision.infoBlur')}
            </p>
          </div>
        </details>
      </Space>
    </div>
  )
})
