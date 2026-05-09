"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recurrenceHelper = exports.describeRecurrence = exports.parseRecurrence = void 0;
// 入口文件
const server_1 = require("./server");
// 导出循环规则助手供外部使用
var recurrence_helper_1 = require("./shared/recurrence-helper");
Object.defineProperty(exports, "parseRecurrence", { enumerable: true, get: function () { return recurrence_helper_1.parseRecurrence; } });
Object.defineProperty(exports, "describeRecurrence", { enumerable: true, get: function () { return recurrence_helper_1.describeRecurrence; } });
Object.defineProperty(exports, "recurrenceHelper", { enumerable: true, get: function () { return recurrence_helper_1.recurrenceHelper; } });
// 启动服务器
(0, server_1.startServer)();
//# sourceMappingURL=index.js.map