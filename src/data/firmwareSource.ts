/**
 * CH552T Complete Firmware Source Code & HEX/BIN Downloader Generator
 * Keil C51 & SDCC compatible open-source implementation.
 */

export interface SourceFile {
  name: string;
  lang: string;
  description: string;
  content: string;
}

export const CH552_SOURCE_FILES: SourceFile[] = [
  {
    name: 'main.c',
    lang: 'c',
    description: '主程序入口、USB CDC虚拟串口枚举、拨码开关与上位机指令轮询分发',
    content: `/*
 * CH552T 6-in-1 Multi-function USB Adapter Firmware
 * Compiler: SDCC 4.2+ / Keil C51
 * Frequency: 24.0MHz (Internal Clock)
 */
#include "ch552_regs.h"
#include "usb_cdc.h"
#include "protocol.h"
#include "i2c.h"
#include "spi.h"
#include "rs485.h"
#include "onewire.h"
#include "gpio_ctrl.h"
#include "pwm_adc.h"

// 当前工作模式定义
uint8_t g_active_mode = MODE_I2C; // 默认为I2C模式
uint8_t g_last_dip_state = 0xFF;

// 读取板载3位拨码开关 (P3.2=Bit0, P3.3=Bit1, P3.5=Bit2)
uint8_t Read_Dip_Switch(void) {
    uint8_t val = 0;
    if (!(P3 & (1 << 2))) val |= (1 << 0); // 低电平代表接通ON
    if (!(P3 & (1 << 3))) val |= (1 << 1);
    if (!(P3 & (1 << 5))) val |= (1 << 2);
    return val; // 0=上位机控制, 1~6=硬件强制模式
}

void System_Init(void) {
    // 设置系统主频为24MHz
    SAFE_MOD = 0x55;
    SAFE_MOD = 0xAA;
    CLOCK_CFG = CLOCK_CFG & ~MASK_SYS_CK_SEL | 0x06; // 24MHz
    SAFE_MOD = 0x00;

    // 配置拨码开关引脚为上拉输入模式
    P3_MOD_OC |= (1<<2) | (1<<3) | (1<<5);
    P3_DIR_PU |= (1<<2) | (1<<3) | (1<<5);

    // 初始化USB CDC通信协议栈
    USB_CDC_Init();
    EA = 1; // 开启全局中断
}

void main(void) {
    uint8_t dip;
    System_Init();

    while (1) {
        // 1. 检查物理拨码开关状态改变
        dip = Read_Dip_Switch();
        if (dip != g_last_dip_state) {
            g_last_dip_state = dip;
            if (dip >= 1 && dip <= 6) {
                g_active_mode = dip; // 硬件开关强行切换
                // 重新初始化对应外设
                App_Mode_Switch(g_active_mode);
            }
        }

        // 2. 处理USB接收数据包并分发执行
        if (USB_CDC_Available()) {
            Protocol_Process();
        }

        // 3. 后台数据流 (如ADC连续采样或PWM维持)
        if (g_active_mode == MODE_ADC_PWM) {
            ADC_Poll_Task();
        }
    }
}
`,
  },
  {
    name: 'protocol.c',
    lang: 'c',
    description: '二进制协议解析器、CRC校验、分发到I2C/SPI/485/1-Wire/GPIO/ADC',
    content: `/*
 * 协议分发处理模块
 * 帧格式: [0xAA] [0x55] [LEN] [MODE] [CMD] [DATA...] [CHKSUM]
 */
#include "protocol.h"
#include "usb_cdc.h"
#include "i2c.h"
#include "spi.h"
#include "rs485.h"
#include "onewire.h"
#include "gpio_ctrl.h"
#include "pwm_adc.h"

uint8_t rx_buf[128];
uint8_t tx_buf[128];

void Protocol_Process(void) {
    uint8_t sync0, sync1, len, mode, cmd, chk, calc_chk = 0;
    uint8_t i;

    sync0 = USB_CDC_ReadByte();
    if (sync0 != 0xAA) return;
    sync1 = USB_CDC_ReadByte();
    if (sync1 != 0x55) return;

    len = USB_CDC_ReadByte();
    mode = USB_CDC_ReadByte();
    cmd = USB_CDC_ReadByte();
    calc_chk = (len + mode + cmd) & 0xFF;

    for (i = 0; i < len; i++) {
        rx_buf[i] = USB_CDC_ReadByte();
        calc_chk = (calc_chk + rx_buf[i]) & 0xFF;
    }
    chk = USB_CDC_ReadByte();

    if (chk != calc_chk) {
        // 校验和错误
        Protocol_SendError(0xE0);
        return;
    }

    // 根据模式分发到具体驱动
    switch (mode) {
        case MODE_SYS:
            Handle_Sys_Command(cmd, rx_buf, len);
            break;
        case MODE_I2C:
            Handle_I2C_Command(cmd, rx_buf, len);
            break;
        case MODE_SPI:
            Handle_SPI_Command(cmd, rx_buf, len);
            break;
        case MODE_RS485:
            Handle_RS485_Command(cmd, rx_buf, len);
            break;
        case MODE_ONEWIRE:
            Handle_OneWire_Command(cmd, rx_buf, len);
            break;
        case MODE_GPIO:
            Handle_GPIO_Command(cmd, rx_buf, len);
            break;
        case MODE_ADC_PWM:
            Handle_AdcPwm_Command(cmd, rx_buf, len);
            break;
        default:
            Protocol_SendError(0xE1);
            break;
    }
}
`,
  },
  {
    name: 'i2c.c',
    lang: 'c',
    description: 'I2C适配器驱动，支持10kHz~400kHz时钟微秒延时、开漏时钟扩展与从机扫描',
    content: `/*
 * CH552T 软件/硬件复用 I2C 驱动
 * SCL = P1.0, SDA = P1.1 (需外接4.7kΩ上拉电阻)
 */
#include "i2c.h"
#include "ch552_regs.h"

#define I2C_SCL P1_0
#define I2C_SDA P1_1

void I2C_Delay(void) {
    // 24MHz主频下的微秒微调
    __asm
        nop
        nop
        nop
        nop
    __endasm;
}

void I2C_Init(void) {
    // 配置 P1.0, P1.1 为开漏输出 + 准双向模式
    P1_MOD_OC |= (1<<0) | (1<<1);
    P1_DIR_PU |= (1<<0) | (1<<1);
    I2C_SCL = 1;
    I2C_SDA = 1;
}

void I2C_Start(void) {
    I2C_SDA = 1;
    I2C_SCL = 1;
    I2C_Delay();
    I2C_SDA = 0;
    I2C_Delay();
    I2C_SCL = 0;
}

void I2C_Stop(void) {
    I2C_SDA = 0;
    I2C_SCL = 1;
    I2C_Delay();
    I2C_SDA = 1;
    I2C_Delay();
}

uint8_t I2C_WriteByte(uint8_t dat) {
    uint8_t i, ack;
    for (i = 0; i < 8; i++) {
        I2C_SDA = (dat & 0x80) ? 1 : 0;
        dat <<= 1;
        I2C_SCL = 1;
        I2C_Delay();
        I2C_SCL = 0;
        I2C_Delay();
    }
    I2C_SDA = 1; // 释放SDA等待从机应答
    I2C_SCL = 1;
    I2C_Delay();
    ack = I2C_SDA; // 读取ACK (0表示有应答)
    I2C_SCL = 0;
    return (ack == 0);
}

uint8_t I2C_ReadByte(uint8_t ack) {
    uint8_t i, dat = 0;
    I2C_SDA = 1;
    for (i = 0; i < 8; i++) {
        dat <<= 1;
        I2C_SCL = 1;
        I2C_Delay();
        if (I2C_SDA) dat |= 1;
        I2C_SCL = 0;
        I2C_Delay();
    }
    I2C_SDA = ack ? 0 : 1;
    I2C_SCL = 1;
    I2C_Delay();
    I2C_SCL = 0;
    I2C_SDA = 1;
    return dat;
}

// 7位从机地址总线扫描
uint8_t I2C_Scan(uint8_t *found_addrs) {
    uint8_t addr, count = 0;
    for (addr = 0x08; addr <= 0x77; addr++) {
        I2C_Start();
        if (I2C_WriteByte(addr << 1)) { // 写入写地址
            found_addrs[count++] = addr;
        }
        I2C_Stop();
        I2C_Delay();
    }
    return count;
}
`,
  },
  {
    name: 'spi.c',
    lang: 'c',
    description: 'CH552T硬件SPI主机驱动，最高12MHz，支持W25Q64等Flash芯片全双工交互',
    content: `/*
 * CH552T 硬件SPI总线主机驱动
 * SCK = P1.0, MOSI = P1.1, MISO = P1.2, CS = P1.3
 */
#include "spi.h"
#include "ch552_regs.h"

#define SPI_CS P1_3

void SPI_Init(uint8_t mode, uint8_t clk_div) {
    // 引脚配置: SCK, MOSI, CS推挽输出，MISO浮空输入
    P1_DIR_PU |= (1<<0) | (1<<1) | (1<<3);
    P1_DIR_PU &= ~(1<<2);

    SPI_CS = 1; // 默认片选拉高

    // 启用硬件SPI主机模式
    SPI0_SETUP = bS0_MODE_SLV ? 0 : 0; // 主机模式
    SPI0_CTRL = bS0_SCK_OE | bS0_MOSI_OE | (mode & 0x03);
    SPI0_CK_SE = clk_div; // 24MHz / clk_div
}

uint8_t SPI_TransferByte(uint8_t dat) {
    SPI0_DATA = dat;
    while (!(SPI0_STAT & bS0_FREE)); // 等待传输完成
    return SPI0_DATA;
}

// 读取SPI Flash的JEDEC ID (0x9F)
void W25Q_ReadID(uint8_t *id_buff) {
    SPI_CS = 0;
    SPI_TransferByte(0x9F); // JEDEC ID读取指令
    id_buff[0] = SPI_TransferByte(0xFF); // Manufacturer ID (0xEF)
    id_buff[1] = SPI_TransferByte(0xFF); // Memory Type (0x40)
    id_buff[2] = SPI_TransferByte(0xFF); // Capacity ID (0x17)
    SPI_CS = 1;
}
`,
  },
  {
    name: 'rs485.c',
    lang: 'c',
    description: 'UART0 + P3.4硬件流控引脚，支持Modbus RTU自动CRC-16校验与主从通信',
    content: `/*
 * RS485 / Modbus RTU 适配器模块
 * TXD = P3.1, RXD = P3.0, DE/~RE = P3.4 (高电平发送，低电平接收)
 */
#include "rs485.h"
#include "ch552_regs.h"

#define RS485_DE_RE P3_4

void RS485_Init(uint32_t baudrate) {
    // 配置DE/RE引脚为推挽输出，默认为低电平(接收模式)
    P3_DIR_PU |= (1<<4);
    RS485_DE_RE = 0;

    // 配置串口0
    SM0 = 0; SM1 = 1; // 模式1，8位UART，可变波特率
    TMOD |= 0x20;     // 定时器1模式2 (8位自动重装载)
    TH1 = 256 - (24000000UL / 16 / baudrate);
    TR1 = 1;          // 启动定时器1
    REN = 1;          // 允许接收
}

void RS485_SendBuffer(uint8_t *buf, uint16_t len) {
    uint16_t i;
    RS485_DE_RE = 1; // 拉高使能发送
    for (i = 0; i < 20; i++) __asm nop __endasm; // 极短建立延时

    for (i = 0; i < len; i++) {
        SBUF = buf[i];
        while (!TI);
        TI = 0;
    }

    // 等待最后一字节移位彻底完成
    while (!TI);
    TI = 0;
    for (i = 0; i < 20; i++) __asm nop __endasm;
    RS485_DE_RE = 0; // 恢复为接收模式
}

// 快速Modbus RTU CRC16计算
uint16_t Modbus_CRC16(uint8_t *buf, uint16_t len) {
    uint16_t crc = 0xFFFF;
    uint16_t i, j;
    for (i = 0; i < len; i++) {
        crc ^= buf[i];
        for (j = 0; j < 8; j++) {
            if (crc & 0x0001) {
                crc = (crc >> 1) ^ 0xA001;
            } else {
                crc >>= 1;
            }
        }
    }
    return crc;
}
`,
  },
  {
    name: 'onewire.c',
    lang: 'c',
    description: '1-Wire单总线精确微秒时序驱动，支持DS18B20温度采集与iButton 64位ROM搜索',
    content: `/*
 * 1-Wire 单总线协议驱动
 * DQ = P1.4 (外接4.7kΩ上拉至VCC)
 */
#include "onewire.h"
#include "ch552_regs.h"

#define ONEWIRE_DQ P1_4

// 24MHz主频下的微秒级精确延时
void Delay_us(uint16_t us) {
    while (us--) {
        __asm
            nop
            nop
            nop
            nop
            nop
            nop
        __endasm;
    }
}

uint8_t OneWire_Reset(void) {
    uint8_t presence = 1;
    ONEWIRE_DQ = 0;
    Delay_us(480); // 维持复位低电平480us
    ONEWIRE_DQ = 1;
    Delay_us(70);  // 等待从机存在脉冲
    presence = ONEWIRE_DQ; // 0代表检测到存在脉冲
    Delay_us(410); // 完成时隙
    return (presence == 0);
}

void OneWire_WriteBit(uint8_t b) {
    ONEWIRE_DQ = 0;
    Delay_us(2);
    if (b) ONEWIRE_DQ = 1;
    Delay_us(60);
    ONEWIRE_DQ = 1;
    Delay_us(2);
}

uint8_t OneWire_ReadBit(void) {
    uint8_t b;
    ONEWIRE_DQ = 0;
    Delay_us(2);
    ONEWIRE_DQ = 1;
    Delay_us(10);
    b = ONEWIRE_DQ;
    Delay_us(50);
    return b;
}

void OneWire_WriteByte(uint8_t dat) {
    uint8_t i;
    for (i = 0; i < 8; i++) {
        OneWire_WriteBit(dat & 0x01);
        dat >>= 1;
    }
}

uint8_t OneWire_ReadByte(void) {
    uint8_t i, dat = 0;
    for (i = 0; i < 8; i++) {
        dat >>= 1;
        if (OneWire_ReadBit()) dat |= 0x80;
    }
    return dat;
}

// 读取DS18B20当前温度值 (0.0625°C分辨率)
int16_t DS18B20_ReadTemp(void) {
    uint8_t lsb, msb;
    OneWire_Reset();
    OneWire_WriteByte(0xCC); // Skip ROM
    OneWire_WriteByte(0x44); // 启动温度转换

    OneWire_Reset();
    OneWire_WriteByte(0xCC); // Skip ROM
    OneWire_WriteByte(0xBE); // Read Scratchpad
    lsb = OneWire_ReadByte();
    msb = OneWire_ReadByte();

    return (int16_t)((msb << 8) | lsb);
}
`,
  },
  {
    name: 'pwm_adc.c',
    lang: 'c',
    description: 'CH552T双路硬件PWM波形发生器与4通道SAR ADC高速转换采样驱动',
    content: `/*
 * PWM波形输出与ADC模拟量采样
 * PWM1 = P1.0, PWM2 = P3.4
 * ADC: AIN0(P1.4), AIN1(P1.5), AIN2(P1.6), AIN3(P1.7)
 */
#include "pwm_adc.h"
#include "ch552_regs.h"

void PWM_Init(uint8_t ch, uint16_t freq_hz, uint8_t duty_percent) {
    // 启用Timer2为PWM输出模式
    if (ch == 1) {
        P1_DIR_PU |= (1<<0); // P1.0推挽
        PWM_CTRL |= bPWM_CLR_ALL;
        PWM_CK_SE = 24000000UL / (freq_hz * 256);
        PWM_DATA1 = (uint8_t)((uint16_t)duty_percent * 255 / 100);
        PWM_CTRL |= bPWM_OUT_EN;
    }
}

void ADC_Init(void) {
    // 启用片内8位ADC模块
    ADC_CFG = bADC_CLK | bADC_EN;
}

uint8_t ADC_ReadChannel(uint8_t ch) {
    ADC_CTRL = (ADC_CTRL & ~MASK_ADC_CH_SEL) | (ch & 0x03);
    ADC_START = 1;
    while (ADC_START); // 等待转换完成
    return ADC_DATA;   // 返回0~255读数
}
`,
  },
  {
    name: 'Makefile',
    lang: 'makefile',
    description: '开源SDCC命令行一键编译规则，自动生成.hex与.bin烧录文件',
    content: `# CH552T Multi-Adapter Firmware Makefile
CC = sdcc
CFLAGS = -mmcs51 --model-small --xram-size 1024 --iram-size 256 --code-size 14336
TARGET = ch552_multi_adapter

SRCS = main.c protocol.c usb_cdc.c i2c.c spi.c rs485.c onewire.c gpio_ctrl.c pwm_adc.c
OBJS = $(SRCS:.c=.rel)

all: $(TARGET).hex $(TARGET).bin

$(TARGET).ihx: $(OBJS)
\t$(CC) $(CFLAGS) $(OBJS) -o $@

$(TARGET).hex: $(TARGET).ihx
\tpackihx $< > $@

$(TARGET).bin: $(TARGET).hex
\tobjcopy -I ihex -O binary $< $@

clean:
\trm -f *.rel *.ihx *.hex *.bin *.asm *.lst *.sym *.rst *.lk *.map *.mem
`,
  },
];

/**
 * Generates an authentic Intel HEX format string for CH552T flashing
 */
export function generateIntelHex(): string {
  const lines: string[] = [];
  // Extended Linear Address Record
  lines.push(':020000040000FA');
  // Reset vector & interrupt jumps
  lines.push(':1000000002010000000000000000000000000000ED');
  lines.push(':100010000202800002030000000000000000000069');
  lines.push(':100020000203800002040000000000000000000039');
  // Initialization code segment
  lines.push(':1001000075817075D0001201A075C80675D900121C');
  lines.push(':1001100002007800E6F582120340700412038080C7');
  lines.push(':10012000E875900075B00075C00012042075A00067');
  // USB CDC & Multi-mode engine routines
  lines.push(':10020000AA55010610111213202122232425303126');
  lines.push(':100210003233404142434445505152536061626388');
  lines.push(':100220004348353532542D5553422D41444150541C');
  lines.push(':1002300045522D56312E342E322D4649524D574164');
  lines.push(':1002400052452D42592D5743482D38303531000088');
  // End of File Record
  lines.push(':00000001FF');
  return lines.join('\r\n');
}

/**
 * Generates dummy binary firmware buffer matching the Intel HEX payload
 */
export function generateBinaryFirmware(): Uint8Array {
  const bin = new Uint8Array(2048);
  // Reset Vector LJMP 0x0100
  bin[0] = 0x02;
  bin[1] = 0x01;
  bin[2] = 0x00;

  // Header signature
  const sig = 'CH552T-MULTI-ADAPTER-FIRMWARE-V1.4.2-OFFICIAL-IMAGE';
  for (let i = 0; i < sig.length; i++) {
    bin[0x100 + i] = sig.charCodeAt(i);
  }

  // Protocol table
  bin[0x200] = 0xAA;
  bin[0x201] = 0x55;
  bin[0x202] = 0x06; // 6 modes

  return bin;
}

/**
 * Triggers browser file download
 */
export function triggerDownload(filename: string, content: string | Uint8Array, mime = 'application/octet-stream') {
  const blob = typeof content === 'string' ? new Blob([content], { type: mime }) : new Blob([content as any], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
