// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract FileVault {
    struct FileData {
        string cid;
        uint unlockTime;
    }

    mapping(address => FileData) public files;

    function lockFile(string memory _cid, uint _unlockTime) external {
        require(bytes(_cid).length > 0, "CID required");
        require(_unlockTime > block.timestamp, "Unlock must be in the future");

        files[msg.sender] = FileData(_cid, _unlockTime);
    }

    function retrieveFile() external view returns (string memory) {
        FileData memory f = files[msg.sender];
        require(bytes(f.cid).length > 0, "No file locked");
        require(block.timestamp >= f.unlockTime, "Oops! You're early 🕒");
        return f.cid;
    }

    function getUnlockTime(address user) public view returns (uint) {
        return files[user].unlockTime;
    }
}
