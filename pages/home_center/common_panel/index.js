// miniprogram/pages/home_center/common_panel/index.js.js
import {
  getDevFunctions,
  getDeviceDetails,
  deviceControl,
  getDeviceSpecifications,
  getElectricity
} from '../../../utils/api/device-api'
import wxMqtt from '../../../utils/mqtt/wxMqtt'
import * as echarts from '../../../utils/ec-canvas/echarts';

let chart = null;

var chart_title = []
var chart_value = []

Page({

  /**
   * 页面的初始数据
   */
  data: {
    device_name: '',
    titleItem: {
      name: '',
      value: '',
    },
    roDpList: {}, //只上报功能点
    rwDpList: {}, //可上报可下发功能点
    isRoDpListShow: false,
    isRwDpListShow: false,
    forest: '../../../image/forest@2x.png',
    ec: {
      lazyLoad: true
    },
    show_count: false,
    time: '00:00',
    sec: '00'
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.echartsComponnet = this.selectComponent('#mychart-dom-bar');
    const {
      device_id
    } = options
    this.setData({
      device_id
    })
    this.getData(device_id)
    // mqtt消息监听
    wxMqtt.on('message', (topic, newVal) => {
      const {
        status
      } = newVal
      this.updateStatus(status)
    })
  },

  getData: async function (device_id) {
    var timestamp = Date.parse(new Date());
    var date = new Date(timestamp);
    //获取年  
    var Y = date.getFullYear();
    //获取月  
    var M = (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1);
    //获取当日 
    var D = date.getDate() < 10 ? '0' + date.getDate() : date.getDate();
    var start_day = Y + M + "01";
    var end_day = Y + M + D;
    const ele_result = await getElectricity(device_id, "add_ele", start_day, end_day)
    console.log(ele_result)
    console.log(ele_result)
    for (var key in ele_result.days) {
      chart_title.push(key.substring(4))
      chart_value.push(ele_result.days[key])
    }
    if (!chart) {
      this.init_echarts(); //初始化图表
    } else {
      this.setOption(); //更新数据
    }
  },

  init_echarts: function () {
    this['echartsComponnet'].init((canvas, width, height) => {
      // 初始化图表
      chart = echarts.init(canvas, null, {
        width: width,
        height: height
      });
      this.setOption();
      // 注意这里一定要返回 chart 实例，否则会影响事件处理等
      return chart;
    });
  },

  setOption: function () {
    chart.clear(); // 清除
    chart.setOption(this['getOption']()); //获取新数据
  },

  getOption: function () {
    // 指定图表的配置项和数据
    var option = {
      legend: {
        data: ['每日电量']
      },
      xAxis: {
        data: chart_title
      },
      yAxis: {},
      series: [{
        name: '每日电量',
        type: 'bar',
        data: chart_value
      }],
      dataZoom: [{
          type: 'slider',
          show: true,
          xAxisIndex: [0],
          handleSize: 20, //滑动条的 左右2个滑动条的大小
          height: 8, //组件高度
          left: 30, //左边的距离
          right: 40, //右边的距离
          bottom: 30, //右边的距离
          handleColor: '#ddd', //h滑动图标的颜色
          handleStyle: {
            borderColor: "#cacaca",
            borderWidth: "1",
            shadowBlur: 2,
            background: "#ddd",
            shadowColor: "#ddd",
          },
          fillerColor: new echarts.graphic.LinearGradient(1, 0, 0, 0, [{
            //给颜色设置渐变色 前面4个参数，给第一个设置1，第四个设置0 ，就是水平渐变
            //给第一个设置0，第四个设置1，就是垂直渐变
            offset: 0,
            color: '#1eb5e5'
          }, {
            offset: 1,
            color: '#5ccbb1'
          }]),
          backgroundColor: '#ddd', //两边未选中的滑动条区域的颜色
          showDataShadow: false, //是否显示数据阴影 默认auto
          showDetail: false, //即拖拽时候是否显示详细数值信息 默认true
          filterMode: 'filter',
        },
        //下面这个属性是里面拖到
        {
          type: 'inside',
          show: true,
          xAxisIndex: [0],
          start: 1,
          end: 100
        }
      ],
    };
    return option;
  },
  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: async function () {
    const {
      device_id
    } = this.data
    const [{
      name,
      status,
      icon
    }, {
      functions = []
    }] = await Promise.all([
      getDeviceDetails(device_id),
      getDevFunctions(device_id),
      getDeviceSpecifications(device_id),
    ]);
    const {
      roDpList,
      rwDpList
    } = this.reducerDpList(status, functions)
    // 获取头部展示功能点信息
    let titleItem = {
      name: '',
      value: '',
    };
    if (Object.keys(roDpList).length > 0) {
      let keys = Object.keys(roDpList)[0];
      titleItem = roDpList[keys];
    } else {
      let keys = Object.keys(rwDpList)[0];
      titleItem = rwDpList[keys];
    }

    const roDpListLength = Object.keys(roDpList).length
    const isRoDpListShow = Object.keys(roDpList).length > 0
    const isRwDpListShow = Object.keys(rwDpList).length > 0

    this.setData({
      titleItem,
      roDpList,
      rwDpList,
      device_name: name,
      isRoDpListShow,
      isRwDpListShow,
      roDpListLength,
      icon
    })
  },

  // 分离只上报功能点，可上报可下发功能点
  reducerDpList: function (status, functions) {
    // 处理功能点和状态的数据
    let roDpList = {};
    let rwDpList = {};
    if (status && status.length) {
      status.map((item) => {
        const {
          code,
          value
        } = item;
        let isExit = functions.find(element => element.code == code);
        if (isExit) {
          let rightvalue = value
          // 兼容初始拿到的布尔类型的值为字符串类型
          if (isExit.type === 'Boolean') {
            rightvalue = value == 'true'
          }

          rwDpList[code] = {
            code,
            value: rightvalue,
            type: isExit.type,
            values: isExit.values,
            name: isExit.name,
          };
        } else {
          roDpList[code] = {
            code,
            value,
            name: code,
          };
        }
      });
    }
    return {
      roDpList,
      rwDpList
    }
  },

  sendDp: async function (e) {
    const dpCode = e.currentTarget.dataset.dpcode
    if (dpCode == "switch") {
      var value = !e.currentTarget.dataset.value
    }
    console.log()
    if (dpCode == "countdown_1") {
      console.log(e.detail.value)
      this.setData({
        time: e.detail.value
      })
      var datetime = e.detail.value.split(":")
      console.log(datetime[1])
      var min = Number(datetime[1])
      var hour = Number(datetime[0])
      var value = (hour * 60 * 60) + (min * 60)
    }
    const {
      device_id
    } = this.data
    const {
      success
    } = await deviceControl(device_id, dpCode, value)
  },

  updateStatus: function (newStatus) {
    let {
      roDpList,
      rwDpList,
      titleItem
    } = this.data
    var datetime = this.data.time.split(":")
    var min = Number(datetime[1])
    var hour = Number(datetime[0])
    var timedate = (hour * 60 * 60) + (min * 60)
    var that = this
    var i = setInterval(function () {
      if (timedate > 0) {
        timedate --;
        var h = Math.floor(timedate / 3600);
        var m = Math.floor((timedate / 60 % 60));
        var s = Math.floor((timedate % 60));

        if (h < 10) {
          h = "0" + h
        }
        if (m < 10) {
          m = "0" + m
        }
        if (s < 10) {
          s = "0" + s 
        }
        var time = h + ":" + m
        that.setData({
          time:time,
          sec:s
        })
      }
      console.log(timedate)
      if (timedate == 0) {
        clearInterval(i)
        that.setData({
          time: "00:00",
          sec: "00"
        })
      }
    }, 1000)
    newStatus.forEach(item => {
      const {
        code,
        value
      } = item
      if (typeof roDpList[code] !== 'undefined') {
        roDpList[code]['value'] = value;
      } else if (rwDpList[code]) {
        rwDpList[code]['value'] = value;
      }
    })

    // 更新titleItem
    if (Object.keys(roDpList).length > 0) {
      let keys = Object.keys(roDpList)[0];
      titleItem = roDpList[keys];
    } else {
      let keys = Object.keys(rwDpList)[0];
      titleItem = rwDpList[keys];
    }

    this.setData({
      titleItem,
      roDpList: {
        ...roDpList
      },
      rwDpList: {
        ...rwDpList
      }
    })
  },

  jumpTodeviceEditPage: function () {
    console.log('jumpTodeviceEditPage')
    const {
      icon,
      device_id,
      device_name
    } = this.data
    wx.navigateTo({
      url: `/pages/home_center/device_manage/index?device_id=${device_id}&device_name=${device_name}&device_icon=${icon}`,
    })
  }
})