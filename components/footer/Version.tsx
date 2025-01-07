import { VERSION } from '@/env/package'

const numberToChinese = {
  '0': '零',
  '1': '一',
  '2': '二',
  '3': '三',
  '4': '四',
  '5': '五',
  '6': '六',
  '7': '七',
  '8': '八',
  '9': '九',
  '.': '', // You can replace this with any magic symbol
} as const

function convertToMagicSymbols(str: string) {
  return str
    .split('')
    .map(char => numberToChinese[char as keyof typeof numberToChinese] || char)
    .join('')
}

const magicVersion = convertToMagicSymbols(VERSION)
export function Version() {
  return (
    <div className="flex flex-row justify-center p-8">
      {magicVersion}
    </div>
  )
}
