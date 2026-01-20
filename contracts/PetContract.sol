// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract PetContract {
    enum PetStatus {Sold, Available}
    
    string public companyName;
    uint petCount;

    // Constructor code is only run when the contract is created
    constructor() {
        petCount=0;
        companyName = "Pete's Pet Shop";
    }

    //declare the structure of the pet data
   struct PetInformation {
        string id;
        string name;
        string gender;
        string dateOfBirth;
        uint price;
        PetStatus status;
    }

    //declare the structure for the owner data
    struct OwnershipRecord {
        address payable ownerId;
        string ownerName;
        string transferDate;
        string phone;
        string email;  
    } 

    // declare the structure for the vaccination record
    struct VaccinationRecord {
        string vaccineName;
        string dateAdministered;
        string doctorname;
        string clinic;
        string phone;
        string email;
    }

    // declare the structure of the training record
    struct TrainingRecord {
        string trainingType;
        string traninerName;
        string organization;
        string phone;
        string trainingDate;
        string progress;
    }

    //declare the structure for the pet information - 
    //which consists of petInfo, ownership, vaccination and trainingrecord
    struct Pet {
        PetInformation petInfo;
        OwnershipRecord[] ownershipRecords;
        VaccinationRecord[] vaccinationHistory;
        TrainingRecord[] trainingHistory;
    }
    //map the pet id to the Pet structure and hold them in the mapping variable pets
    mapping(uint256 => Pet) public pets;

    //write the getter functions
    // function to get the company name getCompanyName() 
    function getCompanyName() public view returns(string memory){
        return companyName;
    }

    //Write a function getNoOfPets to obtain the petCount
    function getNoOfPets() public view returns (uint) {
        return petCount;
    }

     // Function to retrieve pet  information
    function getPetInfo(uint256 petId) public view returns (PetInformation memory) {
        return pets[petId].petInfo;
    }

     // Function to retrieve ownership records
    function getOwnershipRecords(uint256 petId) public view returns (OwnershipRecord[] memory) {
        return pets[petId].ownershipRecords;
    }

    // Function to retrieve vaccination records
    function getVaccinationRecords(uint256 petId) public view returns (VaccinationRecord[] memory) {
        return pets[petId].vaccinationHistory;
    }

    // Function to retrieve training records
    function getTrainingRecords(uint256 petId) public view returns (TrainingRecord[] memory) {
        return pets[petId].trainingHistory;
    }

    //function to register the pet
    function registerPet() public returns (uint256) {
        petCount++;    
        return petCount;
    }

    //create the event
    event PetCreated(
        uint256 petId,
        string id,
        string name,
        string gender,
        string dateOfBirth
    );
       
    // Function to add pet  information
    function addPetInfo(
        uint256 petId,
        string memory _id,
        string memory _name,
        string memory _gender,
        string memory _dateOfBirth,
        uint price
    ) public {
        pets[petId].petInfo = PetInformation(_id, _name, _gender, _dateOfBirth, price, PetStatus.Available);
        emit PetCreated(petId, _id, _name, _gender, _dateOfBirth);

    }

    event ownerCreated(
        uint256 petId,
        address payable ownerId,
        string ownerName,
        string transferDate,
        string phone,
        string email
    );
    
    // Function to add a new ownership record
    function addOwnerShipRecord (uint256 petId, 
        string memory _ownerName,
        string memory _transferDate,
        string memory _phone,
        string memory _email ) public {
            pets[petId].ownershipRecords.push(OwnershipRecord(payable(msg.sender), _ownerName, _transferDate, _phone, _email));
            emit ownerCreated(petId, payable(msg.sender), _ownerName, _transferDate, _phone, _email);
    }

    function addVaccinationRecord (uint256 petId, 
        string memory _vaccineName,
        string memory _dateAdministered,
        string memory _doctorname,
        string memory _clinic,
        string memory _phone,
        string memory _email) public {
            pets[petId].vaccinationHistory.push(VaccinationRecord(_vaccineName, _dateAdministered, _doctorname, _clinic, _phone, _email));
    }

    function addTrainingRecord (uint256 petId, 
         string memory _trainingType,
        string memory _trainerName,
        string memory _organization,
        string memory _phone,
        string memory _trainingDate,
        string memory _progress) public {
            pets[petId].trainingHistory.push(TrainingRecord(_trainingType, _trainerName, _organization, _phone,
        _trainingDate, _progress));
    }

    //create the event to purchase the Pet
    event PetPurchased(
        uint id,
        string name,
        uint price,
        address payable owner,
        PetStatus status
    );


    //add a function to purchase pet with the pet id
    function purchasePet(uint _id) public payable {
        // Fetch the product
        Pet memory petData = pets[_id];
        // Fetch the owner
        uint256 curOwnerId = petData.ownershipRecords.length;
        address payable seller = petData.ownershipRecords[curOwnerId-1].ownerId;
        // Make sure the product has a valid id
        require(petCount > 0 && bytes(petData.petInfo.id).length != 0, "Pet Id cannot be empty" );
        // Require that there is enough Ether in the transaction
        require(msg.value >= petData.petInfo.price);
        // Require that the product has not been purchased already
        require(petData.petInfo.status == PetStatus.Available);
        // Require that the buyer is not the seller
        require(seller != msg.sender);
        // Transfer ownership to the buyer
        petData.ownershipRecords[curOwnerId ++].ownerId = payable(msg.sender);
        // Mark as purchased
        petData.petInfo.status = PetStatus.Sold;
        // Update the pet information
        pets[_id].petInfo = petData.petInfo;
        // Pay the seller by sending them Ether
        payable(seller).transfer(msg.value);
        // Trigger an event
        emit PetPurchased(petCount, petData.petInfo.name, petData.petInfo.price, payable(msg.sender), PetStatus.Sold);
    }
}
