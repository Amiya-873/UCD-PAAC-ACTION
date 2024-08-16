@echo off
setlocal

REM Licensed Materials - Property of HCL*
REM (c) Copyright HCL Technologies Ltd. 2020. All Rights Reserved.
REM
REM Note to U.S. Government Users Restricted Rights:
REM Use, duplication or disclosure restricted by GSA ADP Schedule
REM Contract with HCL Technologies Ltd.
REM
REM * Trademark of HCL Technologies Limited

set PACC_LOCATION=%~dp0.
set PACC_PROGRAM=%~n0

java "-Dpacc.location=%PACC_LOCATION%" "-Dpacc.program=%PACC_PROGRAM%" -cp "%PACC_LOCATION%\lib\pacc-0.1.0.9999999-SNAPSHOT.jar" ucd.pacc.main.DownloadComponentProcessMain %*
