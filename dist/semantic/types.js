"use strict";
// 语义理解层类型定义
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentType = void 0;
// 意图类型枚举
var IntentType;
(function (IntentType) {
    IntentType["CREATE_TASK"] = "create_task";
    IntentType["CREATE_EVENT"] = "create_event";
    IntentType["QUERY_TASKS"] = "query_tasks";
    IntentType["QUERY_EVENTS"] = "query_events";
    IntentType["UPDATE_TASK"] = "update_task";
    IntentType["UPDATE_EVENT"] = "update_event";
    IntentType["COMPLETE_TASK"] = "complete_task";
    IntentType["DELETE_TASK"] = "delete_task";
    IntentType["DELETE_EVENT"] = "delete_event";
    IntentType["EXPAND_TASK"] = "expand_task";
    IntentType["OTHER"] = "other";
})(IntentType || (exports.IntentType = IntentType = {}));
//# sourceMappingURL=types.js.map